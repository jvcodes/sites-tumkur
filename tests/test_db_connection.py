import sys
import os
import django
from pymongo import MongoClient

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitehub.settings')
django.setup()

from django.conf import settings

def test_mongo_connection():
    print("Testing MongoDB Connection...")
    try:
        # 1. Connect
        client = MongoClient("mongodb://localhost:27017/")
        db = client["site_db"]
        
        # 2. Ping
        client.admin.command('ping')
        print("✅ MongoDB is reachable.")
        
        # 3. Check Data
        count = db.sites.count_documents({})
        print(f"✅ 'sites' collection found with {count} documents.")
        
        if count == 0:
            print("⚠️ Warning: Database is empty. You might need to run seed data.")
        
        return True
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        return False

if __name__ == "__main__":
    success = test_mongo_connection()
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
