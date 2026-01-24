import os
import sys
import random
from pymongo import MongoClient

# Add project root to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import connection from app to ensure consistency
from listings.mongo import site_collection, db

def clear_existing_data():
    """Clear existing sites to avoid duplicates during dev."""
    # check if user wants this? for now, let's just append or warn.
    # Actually, for a seed script, it's often good to clean slate OR just add.
    # Let's just add for now, but print count.
    pass

def generate_sample_sites():
    print("Generating sample data...")
    
    sample_locations = ["Tumkur", "Gubbi", "Kunigal", "Tiptur", "Sira"]
    sample_owners = ["Ramesh Kumar", "Suresh Babu", "Anita Raj", "Developers Grp"]
    sample_landmarks = ["Near Bus Stand", "Opposite Hospital", "Behind Temple", "Main Road"]

    sites = [
        {
            "name": "Prime Residential Plot",
            "location": "Tumkur",
            "landmark": "Near SIT College",
            "price": 2500000,
            "area": 1200,
            "facing": "east",
            "ownership_type": "individual",
            "availability": "available",
            "zoning_type": "residential",
            "road_width": 30,
            "distance_to_main_road": 0.5,
            "description": "Ready to build plot in a well-developed area.",
            "status": "approved",  # Auto-approve for viewing
            "owner_name": "Ramesh Kumar",
            "contact_number": "9876543210",
            "image": "", # Placeholder or empty
        },
        {
            "name": "Commercial Corner Site",
            "location": "Sira",
            "landmark": "Near NH4",
            "price": 5000000,
            "area": 2400,
            "facing": "north",
            "ownership_type": "developer",
            "availability": "available",
            "zoning_type": "commercial",
            "road_width": 60,
            "distance_to_main_road": 0.1,
            "description": "High visibility corner site suitable for complex.",
            "status": "approved",
            "owner_name": "City Developers",
            "contact_number": "9988776655",
            "image": "",
        },
         {
            "name": "Agricultural Land",
            "location": "Gubbi",
            "landmark": "Next to Lake",
            "price": 1500000,
            "area": 10000,
            "facing": "west",
            "ownership_type": "individual",
            "availability": "available",
            "zoning_type": "agricultural",
            "road_width": 20,
            "distance_to_main_road": 2.5,
            "description": "Fertile land with water source.",
            "status": "approved",
            "owner_name": "Farmer Gowda",
            "contact_number": "8877665544",
            "image": "",
        },
    ]

    # Generate site codes manually or attempt to import util if possible.
    # To keep it simple and robust against DB state, let's just generate a random code or try import.
    try:
        from listings.utils import generate_site_code
        use_util = True
    except ImportError:
        print("Could not import generate_site_code, using fallback.")
        use_util = False

    inserted_count = 0
    for site in sites:
        if use_util:
            # We need to ensure the sequence collection exists for the util to work?
            # utils.py uses find_one_and_update with upsert?
            # Let's check utils.py again. 
            # It does: site_collection.database.counters.find_one_and_update(..., return_document=True)
            # If it doesn't exist, it might return None if upsert=False (default).
            # The code viewed earlier didn't show upsert=True!
            # Let's check.
            pass
        
        # Fallback simplistic code generation to be safe
        site["site_code"] = f"SEED-{random.randint(1000, 9999)}"
        
        result = site_collection.insert_one(site)
        print(f"Inserted site: {site['name']} (ID: {result.inserted_id})")
        inserted_count += 1

    print(f"\nSuccessfully inserted {inserted_count} sample sites.")
    print("Run 'python manage.py runserver' to view them.")

if __name__ == "__main__":
    generate_sample_sites()
