import os
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

# Ensure dotenv is loaded with absolute path
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, '.env'))

import sys

# Get MONGO_URI and MONGO_DB_NAME from environment variables or fallback to defaults
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/")
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "site_db")

# Use mongomock for testing to avoid hitting a real database and timing out
if 'test' in sys.argv or os.environ.get("USE_MONGOMOCK") == "1":
    import mongomock
    print("USING MONGOMOCK FOR TESTS!")
    client = mongomock.MongoClient()
    db = client[MONGO_DB_NAME]
    # Auto-seed mock data for frontend E2E tests
    if os.environ.get("USE_MONGOMOCK") == "1":
        try:
            import json
            mock_db_path = os.path.join(BASE_DIR, 'frontend', 'tests', 'mock_db.json')
            with open(mock_db_path, 'r') as f:
                data = json.load(f)
                if data.get("results"):
                    db["sites"].insert_many(data["results"])
                    print(f"Seeded {len(data['results'])} mock sites into mongomock.")
        except Exception as e:
            print(f"Warning: Failed to auto-seed mongomock: {e}")
else:
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB_NAME]

# Core Collections
site_collection = db["sites"]
chat_collection = db["chats"]
booking_collection = db["bookings"]

# New Normalized Collections
locations_collection = db["locations"]
landmarks_collection = db["landmarks"]
site_images_collection = db["site_images"]
visits_collection = db["visits"]
user_profiles_collection = db["user_profiles"]
agents_collection = db["agents"]
carts_collection = db["carts"]
drafts_collection = db["drafts"]

def setup_database_indexes():
    """Create indexes for scalability and data integrity."""
    # Sites Indexes
    site_collection.create_index("site_code", unique=True)
    site_collection.create_index("location_id")
    site_collection.create_index("price")
    site_collection.create_index("status")
    site_collection.create_index("user_id")
    site_collection.create_index("is_deleted")
    site_collection.create_index("is_test")
    site_collection.create_index([("user_id", 1), ("dimension", 1), ("location_id", 1)]) # Help prevent duplicates
    # Compound indexes for fast filtered searches and reels queries
    site_collection.create_index([("status", 1), ("is_deleted", 1), ("created_at", -1)])
    site_collection.create_index([("status", 1), ("is_deleted", 1), ("price", 1)])
    site_collection.create_index([("status", 1), ("is_deleted", 1), ("youtube_url", 1)])
    
    # Locations Indexes
    locations_collection.create_index([("city", 1), ("area", 1)], unique=True)
    locations_collection.create_index("city")
    
    # Images Indexes
    site_images_collection.create_index("site_code")
    
    # User Profiles
    user_profiles_collection.create_index("email", unique=True, sparse=True)
    user_profiles_collection.create_index("phone", unique=True, sparse=True)
    
    # Visits
    visits_collection.create_index("user_id")
    visits_collection.create_index("site_code")
    visits_collection.create_index([("user_id", 1), ("site_code", 1)], unique=True)

    # Agents — phone is primary unique identifier
    agents_collection.create_index("phone", unique=True)
    agents_collection.create_index("is_active")

# Run index setup
try:
    setup_database_indexes()
except Exception as e:
    print(f"Warning: Index setup failed (might already exist): {e}")
