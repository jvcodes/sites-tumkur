from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()

# Try to initialize Firebase
from .firebase_admin_setup import initialize_firebase_admin
initialize_firebase_admin()
from firebase_admin import auth as firebase_auth

@api_view(['POST'])
@permission_classes([AllowAny])
def phone_auth_api(request):
    """
    Verifies Firebase ID token and authenticates/registers the user via Phone Number.
    Payload: { "idToken": "ey..." }
    """
    id_token = request.data.get('idToken')
    
    if not id_token:
        return Response({"error": "Firebase ID Token is required"}, status=400)
    
    try:
        # Verify the token against Firebase
        decoded_token = firebase_auth.verify_id_token(id_token)
        phone_number = decoded_token.get('phone_number')
        
        if not phone_number:
            return Response({"error": "No phone number found in token"}, status=400)
            
        # 1. Get or Create User based on Phone Number
        # We will use the phone number as the username and a placeholder email if none exists
        import re
        digits = re.sub(r'\D', '', phone_number)
        phone_number = digits[-10:] if len(digits) >= 10 else digits
        
        try:
            # Look up by username (which we set to phone_number)
            user = User.objects.get(username=phone_number)
            action = "Login"
        except User.DoesNotExist:
            user = User.objects.create_user(
                username=phone_number,
                email=f"{phone_number}@placeholder.com"
            )
            user.save()
            action = "Signup"
            
        # 2. Get or Create Django Token
        token, _ = Token.objects.get_or_create(user=user)
        
        # 3. Handle MongoDB Profile
        from listings.mongo import user_profiles_collection
        from datetime import datetime
        
        user_profile = user_profiles_collection.find_one({"phone": phone_number})
        if not user_profile:
            user_profiles_collection.insert_one({
                "phone": phone_number,
                "name": "New User",
                "email": "",
                "role": "Buyer",
                "created_at": datetime.now()
            })
            
        profile_data = user_profiles_collection.find_one({"phone": phone_number})
        
        return Response({
            "message": f"Successfully {action}",
            "token": token.key,
            "user": {
                "id": user.id,
                "username": user.username,
                "phone": profile_data.get("phone", phone_number),
                "name": profile_data.get("name", "New User"),
                "email": profile_data.get("email", ""),
                "role": profile_data.get("role", "Buyer"),
            }
        })
        
    except Exception as e:
        print(f"Firebase Verification Error: {e}")
        return Response({"error": f"Firebase Verification Error: {str(e)}"}, status=401)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth_api(request):
    """
    Simulates Google Login.
    Payload: { "email": "foo@gmail.com", "name": "Foo Bar" }
    """
    email = request.data.get('email')
    name = request.data.get('name')
    
    if not email:
        return Response({"error": "Email is required"}, status=400)
    
    # 1. Get or Create User
    # We use email as username for simplicity in this simulated flow
    try:
        user = User.objects.get(email=email)
        action = "Login"
    except User.DoesNotExist:
        username = email.split('@')[0]
        # Ensure username is unique
        if User.objects.filter(username=username).exists():
             username = f"{username}_{User.objects.count()}"
             
        user = User.objects.create_user(username=username, email=email)
        user.first_name = name or username
        user.save()
        action = "Signup"
        
    # 2. Get or Create Token
    token, _ = Token.objects.get_or_create(user=user)
    
    from listings.mongo import user_profiles_collection
    from datetime import datetime
    
    # Update or Create User Profile in MongoDB
    user_profile = user_profiles_collection.find_one({"email": email})
    if not user_profile:
        user_profiles_collection.insert_one({
            "email": email,
            "name": name or username,
            "role": "Buyer", # Default role
            "phone": "",
            "created_at": datetime.now()
        })
    elif name and not user_profile.get("name"):
        user_profiles_collection.update_one({"email": email}, {"$set": {"name": name}})
        
    # Fetch latest profile
    profile_data = user_profiles_collection.find_one({"email": email})

    return Response({
        "message": f"Successfully {action}",
        "token": token.key,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": profile_data.get("name", user.first_name),
            "role": profile_data.get("role", "Buyer"),
            "phone": profile_data.get("phone", "")
        }
    })


@api_view(['GET'])
def my_profile_api(request):
    """Fetch complete profile from normalized user_profiles_collection"""
    email = request.GET.get('email')
    phone = request.GET.get('phone')

    import re
    if phone:
        digits = re.sub(r'\D', '', phone)
        phone = digits[-10:] if len(digits) >= 10 else digits

    if not email and not phone:
        return Response({"error": "Email or phone is required"}, status=400)
        
    from listings.mongo import user_profiles_collection
    
    if email:
        profile = user_profiles_collection.find_one({"email": email})
    else:
        profile = user_profiles_collection.find_one({"phone": phone})
    
    if not profile:
        return Response({"error": "Profile not found"}, status=404)
        
    profile["id"] = str(profile["_id"])
    del profile["_id"]
    
    return Response(profile)


@api_view(['POST'])
@permission_classes([AllowAny])
def update_phone_api(request):
    """Update phone number for a user profile. Payload: { email, phone }"""
    email = request.data.get('email', '').strip()
    phone = request.data.get('phone', '').strip()

    if not email or not phone:
        return Response({"error": "Email and phone are required"}, status=400)

    # Validate Indian phone: 10 digits starting with 6-9
    import re
    digits_only = re.sub(r'\D', '', phone)
    clean_phone = digits_only[-10:] if len(digits_only) >= 10 else digits_only
    if not re.match(r'^[6-9]\d{9}$', clean_phone) or len(digits_only) < 10:
        return Response({"error": "Please enter a valid 10-digit Indian mobile number"}, status=400)
    
    phone = clean_phone

    from listings.mongo import user_profiles_collection
    result = user_profiles_collection.update_one(
        {"email": email},
        {"$set": {"phone": phone}},
        upsert=False
    )

    if result.matched_count == 0:
        return Response({"error": "Profile not found"}, status=404)

    return Response({"message": "Phone number updated successfully", "phone": phone})


@api_view(['POST'])
@permission_classes([AllowAny])
def update_profile_api(request):
    """Update profile details for a user. Payload: { identifier, name, email }
       identifier can be the current email or phone.
    """
    identifier = request.data.get('identifier', '').strip()
    name = request.data.get('name', '').strip()
    new_email = request.data.get('email', '').strip()

    if not identifier:
        return Response({"error": "Identifier is required"}, status=400)

    update_fields = {}
    if name:
        update_fields["name"] = name
    if new_email:
        update_fields["email"] = new_email

    if not update_fields:
        return Response({"error": "No fields to update"}, status=400)

    from listings.mongo import user_profiles_collection
    
    # Clean identifier if it's a phone number
    import re
    if "@" not in identifier:
        digits = re.sub(r'\D', '', identifier)
        identifier = digits[-10:] if len(digits) >= 10 else digits
    
    # Find user by identifier (either email or phone)
    query = {"email": identifier} if "@" in identifier else {"phone": identifier}
    
    result = user_profiles_collection.update_one(
        query,
        {"$set": update_fields},
        upsert=False
    )

    if result.matched_count == 0:
        return Response({"error": "Profile not found"}, status=404)

    return Response({"message": "Profile updated successfully"})
