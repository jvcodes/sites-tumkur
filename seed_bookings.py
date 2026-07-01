import os
import sys
import django
import random
from datetime import datetime, timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sitehub.settings')
django.setup()

from listings.mongo import booking_collection, agents_collection, site_collection

def seed_bookings():
    names = ["Vivek", "Sandeep", "Kiran", "Aditya", "Rahul"]
    phones = ["9876543210", "8765432109", "7654321098", "6543210987", "5432109876"]
    
    # Get active agents to optionally assign
    agents = list(agents_collection.find({"is_active": {"$ne": False}}))
    agent_names = [a.get("name") for a in agents if a.get("name")]
    
    # Get some sites
    sites = list(site_collection.find({"is_deleted": {"$ne": True}}).limit(10))
    site_dicts = [{"site_code": s.get("site_code"), "name": s.get("name")} for s in sites]
    
    docs = []
    base_time = datetime.utcnow()
    
    for i in range(1, 151):
        # Pick 1 random site
        booked_sites = [random.choice(site_dicts)] if site_dicts else [{"site_code": f"DUMMY-{i}", "name": "Dummy Site"}]
        
        # 50% chance to assign an agent
        agent = random.choice(agent_names) if agent_names and random.random() > 0.5 else None
        
        # 30% chance to be approved, 70% pending
        status = "approved" if random.random() > 0.7 else "pending"
        
        # Pick a date within the next 30 days
        visit_date = (base_time + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d")
        visit_time = f"{random.randint(9, 17):02d}:00"
        
        doc = {
            "name": f"{random.choice(names)} {i}",
            "phone": random.choice(phones),
            "date": visit_date,
            "time": visit_time,
            "sites": booked_sites,
            "status": status,
            "created_at": base_time - timedelta(minutes=i)
        }
        
        if agent:
            doc["broker_name"] = agent
            
        docs.append(doc)
        
    booking_collection.insert_many(docs)
    print(f"Inserted {len(docs)} dummy bookings.")

if __name__ == "__main__":
    seed_bookings()
