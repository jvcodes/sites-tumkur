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
    
    return Response({
        "message": f"Successfully {action}",
        "token": token.key,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "name": user.first_name
        }
    })
