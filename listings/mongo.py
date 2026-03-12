from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017/")
db = client["site_db"]

# Core Collections
site_collection = db["sites"]
chat_collection = db["chats"]
booking_collection = db["bookings"]

# New Normalized Collections
locations_collection = db["locations"]
site_images_collection = db["site_images"]
visits_collection = db["visits"]
user_profiles_collection = db["user_profiles"]
agents_collection = db["agents"]

def setup_database_indexes():
    """Create indexes for scalability and data integrity."""
    # Sites Indexes
    site_collection.create_index("site_code", unique=True)
    site_collection.create_index("location_id")
    site_collection.create_index("price")
    site_collection.create_index("status")
    site_collection.create_index("user_id")
    site_collection.create_index("is_deleted")
    site_collection.create_index([("user_id", 1), ("dimension", 1), ("location_id", 1)]) # Help prevent duplicates
    
    # Locations Indexes
    locations_collection.create_index([("city", 1), ("area", 1)], unique=True)
    locations_collection.create_index("city")
    
    # Images Indexes
    site_images_collection.create_index("site_code")
    
    # User Profiles
    user_profiles_collection.create_index("email", unique=True)
    
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
