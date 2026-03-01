from rest_framework.decorators import api_view
from rest_framework.response import Response
from datetime import datetime

from listings.mongo import visits_collection, site_collection
from .views import hydrate_sites
from .serializers import SiteSerializer

@api_view(['POST'])
def visit_site_api(request):
    """Record a user visit to a specific site."""
    user_id = request.data.get("user_id") # using email as ID
    site_code = request.data.get("site_code")
    
    if not user_id or not site_code:
        return Response({"error": "user_id and site_code are required"}, status=400)
    
    # Check if a visit already exists to avoid dupes, or update timestamp
    existing = visits_collection.find_one({"user_id": user_id, "site_code": site_code})
    
    if existing:
        visits_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {"visit_date": datetime.now()}}
        )
    else:
        visits_collection.insert_one({
            "user_id": user_id,
            "site_code": site_code,
            "visit_date": datetime.now(),
            "status": "viewed"
        })
        
    return Response({"message": "Visit recorded"}, status=200)

@api_view(['GET'])
def my_visits_api(request):
    """Fetch all sites a user has visited."""
    user_id = request.GET.get("user_id")
    
    if not user_id:
        return Response({"error": "user_id is required"}, status=400)
        
    visits = list(visits_collection.find({"user_id": user_id}).sort("visit_date", -1))
    
    if not visits:
        return Response([])
        
    site_codes = [v["site_code"] for v in visits]
    sites = list(site_collection.find({"site_code": {"$in": site_codes}, "is_deleted": {"$ne": True}}))
    hydrated_sites = hydrate_sites(request, sites)
    
    site_map = {s["site_code"]: s for s in hydrated_sites}
    
    results = []
    for visit in visits:
        code = visit["site_code"]
        if code in site_map:
            site_data = site_map[code]
            # Need to append visit specifics
            site_data["visit_date"] = visit["visit_date"]
            site_data["visit_status"] = visit.get("status", "viewed")
            results.append(site_data)
            
    serializer = SiteSerializer(results, many=True)
    return Response(serializer.data)
