from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token

User = get_user_model()

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
    if not email:
        return Response({"error": "Email is required"}, status=400)
        
    from listings.mongo import user_profiles_collection
    profile = user_profiles_collection.find_one({"email": email})
    
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
    if not re.match(r'^[6-9]\d{9}$', phone):
        return Response({"error": "Please enter a valid 10-digit Indian mobile number"}, status=400)

    from listings.mongo import user_profiles_collection
    result = user_profiles_collection.update_one(
        {"email": email},
        {"$set": {"phone": phone}},
        upsert=False
    )

    if result.matched_count == 0:
        return Response({"error": "Profile not found"}, status=404)

    return Response({"message": "Phone number updated successfully", "phone": phone})
