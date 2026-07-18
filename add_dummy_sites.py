import random
import uuid
import datetime
import sys
import os

# Add the project root to sys.path to import Django settings
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from listings.mongo import site_collection
except ImportError:
    print("Could not import site_collection. Make sure you run this script from the project root.")
    sys.exit(1)

# Sample Data
LOCATIONS = [
    "Tumkur", "Bengaluru", "Mysuru", "Hubballi", "Mangaluru", 
    "Belagavi", "Davanagere", "Ballari", "Vijayapura", "Shivamogga"
]

LAYOUT_NAMES = [
    "Silver Oak Layout", "Green Valley", "Sunrise Residency", 
    "Golden Enclave", "Royal Palms", "Lakeview Layout"
]

FACINGS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"]
YOUTUBE_URLS = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=3JZ_D3ELwOQ"
]
IMAGE_URL = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000&auto=format&fit=crop"

def generate_dummy_site():
    is_layout = random.choice([True, False])
    location = random.choice(LOCATIONS)
    area = random.randint(1000, 5000)
    
    # Calculate price based on area and location (randomized)
    price_per_sqft = random.randint(1500, 5000)
    total_price = area * price_per_sqft

    site = {
        "site_code": f"DUMMY-{str(uuid.uuid4())[:8].upper()}",
        "name": f"Premium Plot in {location}",
        "location": location,
        "landmark": f"Near {random.choice(['Hospital', 'School', 'Mall', 'Highway'])}",
        "youtube_url": random.choice(YOUTUBE_URLS),
        "latitude": str(12.9716 + random.uniform(-0.1, 0.1)),
        "longitude": str(77.5946 + random.uniform(-0.1, 0.1)),
        "area": str(area),
        "dimension": f"{random.randint(30, 50)} x {random.randint(40, 100)}",
        "facing": random.choice(FACINGS),
        "price": str(total_price),
        "road_width": f"{random.choice([30, 40, 60])} Feet",
        "corner_site": random.choice([True, False]),
        "boundary_marked": random.choice([True, False]),
        "water_facility": random.choice([True, False]),
        "electricity": random.choice([True, False]),
        "drainage": random.choice([True, False]),
        "is_layout": is_layout,
        "layout_name": random.choice(LAYOUT_NAMES) if is_layout else "",
        "owner": "SiteHub Admin",
        "phone": "9999999999",
        "email": "admin@sitehub.com",
        "image": IMAGE_URL,
        "status": "Available",
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    return site

def main():
    print("Generating 1000 dummy sites...")
    sites = [generate_dummy_site() for _ in range(1000)]
    
    print("Inserting into MongoDB...")
    result = site_collection.insert_many(sites)
    
    print(f"Successfully inserted {len(result.inserted_ids)} dummy sites.")

if __name__ == "__main__":
    main()
