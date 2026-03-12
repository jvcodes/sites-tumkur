from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from listings.mongo import db
from .views import normalize_image

# MongoDB Collection
wishlist_collection = db['wishlists']
site_collection = db['sites']

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_wishlist(request):
    """
    Get all sites in the user's wishlist.
    """
    user_id = request.user.id
    
    # 1. Get Wishlist Doc
    wishlist_doc = wishlist_collection.find_one({"user_id": user_id})
    if not wishlist_doc or not wishlist_doc.get("sites"):
        return Response([])
        
    site_ids = wishlist_doc["sites"] # List of site_codes or IDs
    
    # 2. Fetch Sites details
    # Assuming we store site_code in wishlist for stability
    sites_cursor = site_collection.find({"site_code": {"$in": site_ids}})
    sites = list(sites_cursor)
    
    # 3. Serialize (Manually for speed/simplicity matching existing patterns)
    results = []
    for s in sites:
        s["id"] = str(s["_id"])
        del s["_id"]
        if s.get("image"):
             s["image"] = normalize_image(request, s["image"])
        results.append(s)
        
    return Response(results)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_wishlist(request):
    """
    Add or Remove a site from wishlist.
    Payload: { "site_code": "SEED-123" }
    """
    user_id = request.user.id
    site_code = request.data.get("site_code")
    
    if not site_code:
        return Response({"error": "site_code required"}, status=400)
    
    # 1. Get or Create Wishlist
    wishlist_doc = wishlist_collection.find_one({"user_id": user_id})
    if not wishlist_doc:
        wishlist_doc = {"user_id": user_id, "sites": []}
        
    current_sites = wishlist_doc.get("sites", [])
    
    # 2. Toggle
    if site_code in current_sites:
        current_sites.remove(site_code)
        action = "removed"
    else:
        current_sites.append(site_code)
        action = "added"
        
    # 3. Save
    wishlist_collection.update_one(
        {"user_id": user_id},
        {"$set": {"sites": current_sites}},
        upsert=True
    )
    
    return Response({
        "message": f"Site {action} to wishlist",
        "liked": action == "added",
        "site_code": site_code
    })
