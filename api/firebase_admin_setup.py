import firebase_admin
from firebase_admin import credentials
import os
from django.conf import settings

def initialize_firebase_admin():
    if not firebase_admin._apps:
        try:
            # First, check if credentials are provided in an environment variable (for Render production)
            firebase_cred_json = os.environ.get('FIREBASE_CRED_JSON')
            if firebase_cred_json:
                import json
                cred_dict = json.loads(firebase_cred_json)
                cred = credentials.Certificate(cred_dict)
            else:
                # Fallback to local file for development
                cred_path = os.path.join(settings.BASE_DIR, 'api', 'firebase-credentials.json')
                cred = credentials.Certificate(cred_path)
                
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK Initialized Successfully")
        except Exception as e:
            print(f"Warning: Failed to initialize Firebase Admin SDK. {e}")
