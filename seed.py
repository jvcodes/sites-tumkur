import os
import sys
import django
import random
from datetime import datetime, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitehub.settings')
django.setup()

from listings.mongo import site_collection

def seed_sites():
    locations = ["Tumkur", "Bangalore", "Mysore", "Hubli", "Mangalore"]
    facings = ["North", "South", "East", "West", "North-East"]
    owners = ["Raju", "Kiran", "Suresh", "Ramesh", "Anil"]
    
    docs = []
    base_time = datetime.utcnow()
    
    for i in range(1, 151):
        site_code = f"SEED-{1000 + i}"
        doc = {
            "site_code": site_code,
            "name": f"Dummy Site {i}",
            "location": random.choice(locations),
            "price": str(random.randint(10, 100) * 100000),
            "area": str(random.randint(1000, 5000)),
            "facing": random.choice(facings),
            "owner": random.choice(owners),
            "uploaded_phone": f"98765{random.randint(10000, 99999)}",
            "status": "pending",
            "is_deleted": False,
            "created_at": base_time - timedelta(minutes=i)
        }
        docs.append(doc)
        
    site_collection.insert_many(docs)
    print(f"Inserted {len(docs)} dummy pending sites.")

if __name__ == "__main__":
    seed_sites()
