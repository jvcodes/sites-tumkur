import os
import sys
from pymongo import MongoClient, ASCENDING, DESCENDING

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Connect to DB (Hardcoded for script simplicity, or could import settings)
client = MongoClient("mongodb://localhost:27017/")
db = client["site_db"]
sites = db["sites"]

def create_indexes():
    print("Creating indexes for 'sites' collection...")

    # 1. Status Index (Critical for filtering Approved/Pending)
    print("- Creating Index: status (ASC)")
    sites.create_index([("status", ASCENDING)])

    # 2. Location Index (For search)
    print("- Creating Index: location (ASC)")
    sites.create_index([("location", ASCENDING)])
    
    # 3. Price Index (For range queries & sorting)
    print("- Creating Index: price (ASC)")
    sites.create_index([("price", ASCENDING)])

    # 4. Compound Index: Status + Location + Price (Common query pattern)
    print("- Creating Compound Index: status + location + price")
    sites.create_index([
        ("status", ASCENDING),
        ("location", ASCENDING),
        ("price", ASCENDING)
    ])

    # 5. Site Code (Unique lookup)
    print("- Creating Unique Index: site_code")
    sites.create_index([("site_code", ASCENDING)], unique=True)

    print("\nIndexes created successfully:")
    for idx in sites.list_indexes():
        print(f" - {idx['name']}: {idx['key']}")

if __name__ == "__main__":
    create_indexes()
