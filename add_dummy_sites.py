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

# Tumkur specific Data
LOCATIONS = [
    "S.S. Puram", "Mandipet", "Melekote", "Batawadi", "Sadashivanagar", "Sira Gate", 
    "Jayanagar", "Gokula Extension", "Saraswathipuram", "Bheemasandra", "Maralur", 
    "Gandhi Nagar", "Sapthagiri Extension", "Heggere", "Belagumba", "Devarayapatna", 
    "Kyathasandra", "Antharasanahalli", "Vasanthanarasapura", "Shettihalli", 
    "Arakere", "Kora", "Satyamangala", "Dibbur", "Manchakalkuppe", "Oorkarpet", 
    "Upparahalli", "Siddarameshwara Extension", "Kuvempu Nagar", "Vivekananda Nagar", "Shanti Nagar"
]

LAYOUT_NAMES = [
    "Silver Oak Layout", "Green Valley Tumkur", "Sunrise Residency", 
    "Golden Enclave", "Royal Palms", "Lakeview Layout", "Siddhartha Nagar Layout"
]

FACINGS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"]
YOUTUBE_URLS = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=3JZ_D3ELwOQ"
]
IMAGE_URL = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1000&auto=format&fit=crop"

# Tumkur City Center Coordinates
TUMKUR_LAT = 13.3379
TUMKUR_LNG = 77.1173

def generate_dummy_site():
    is_layout = random.choice([True, False])
    location = random.choice(LOCATIONS)
    area = random.randint(1000, 5000)
    
    # Calculate price based on area and location (randomized)
    price_per_sqft = random.randint(1500, 5000)
    total_price = area * price_per_sqft

    # 60% chance to be within 10km (~0.09 degrees), 40% chance within 30km (~0.27 degrees)
    if random.random() < 0.6:
        # 10km radius
        lat_offset = random.uniform(-0.09, 0.09)
        lng_offset = random.uniform(-0.09, 0.09)
    else:
        # 30km radius
        lat_offset = random.uniform(-0.27, 0.27)
        lng_offset = random.uniform(-0.27, 0.27)

    site_lat = TUMKUR_LAT + lat_offset
    site_lng = TUMKUR_LNG + lng_offset

    site = {
        "site_code": f"DUMMY-{str(uuid.uuid4())[:8].upper()}",
        "name": f"Premium Plot near {location}",
        "location": location,
        "landmark": f"Near {random.choice(['Hospital', 'School', 'Mall', 'Highway'])}",
        "youtube_url": random.choice(YOUTUBE_URLS),
        "latitude": str(site_lat),
        "longitude": str(site_lng),
        "area": area,
        "dimension": f"{random.randint(30, 50)} x {random.randint(40, 100)}",
        "facing": random.choice(FACINGS),
        "price": total_price,
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
        "status": "approved",
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    return site

def main():
    print("Generating 1000 localized Tumkur dummy sites...")
    sites = [generate_dummy_site() for _ in range(1000)]
    
    print("Inserting into MongoDB...")
    result = site_collection.insert_many(sites)
    
    print(f"Successfully inserted {len(result.inserted_ids)} dummy sites localized in Tumkur.")

if __name__ == "__main__":
    main()
