from rest_framework.decorators import api_view
from rest_framework.response import Response
from listings.mongo import site_collection, locations_collection

from django.core.cache import cache

# --------------------------------------------------
# 🔹 GET: Distinct Locations from DB (Dynamic dropdown)
# --------------------------------------------------
@api_view(['GET'])
def get_locations_api(request):
    """Returns a sorted list of unique location names from approved sites with caching."""
    cached_locations = cache.get("sitehub_locations_list")
    if cached_locations is not None:
        return Response({"locations": cached_locations})
    
    # From locations_collection (normalised locations)
    loc_cursor = locations_collection.find({}, {"city": 1, "_id": 0})
    from_collection = sorted({d["city"] for d in loc_cursor if d.get("city")})

    # Also collect any raw location strings stored directly on site docs
    raw_locs = site_collection.distinct("location", {
        "status": "approved",
        "is_deleted": {"$ne": True},
        "location": {"$nin": [None, ""]}
    })

    combined = sorted(set(from_collection) | set(raw_locs))
    cache.set("sitehub_locations_list", combined, 300) # 5 minutes TTL
    return Response({"locations": combined})
