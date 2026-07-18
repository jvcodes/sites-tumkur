from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from listings.mongo import carts_collection, site_collection
from .views import hydrate_sites
from .serializers import SiteSerializer
import re

def _normalize_user_id(user_id):
    if not user_id:
        return ""
    if "@" not in user_id:
        digits = re.sub(r'\D', '', user_id)
        return digits[-10:] if len(digits) >= 10 else digits
    return user_id.strip()

@api_view(['GET'])
@permission_classes([AllowAny])
def get_cart(request):
    """
    Get all sites in the user's cart.
    GET /api/cart/?user_id=...
    """
    user_id = request.GET.get("user_id") or request.GET.get("email")
    user_id = _normalize_user_id(user_id)
    if not user_id:
        return Response([])

    cart_doc = carts_collection.find_one({"user_id": user_id})
    if not cart_doc or not cart_doc.get("sites"):
        return Response([])
    
    site_codes = [s.get("site_code") if isinstance(s, dict) else s for s in cart_doc["sites"]]
    
    # Fetch & hydrate full site details
    sites = list(site_collection.find({
        "site_code": {"$in": site_codes},
        "is_deleted": {"$ne": True}
    }))
    sites = hydrate_sites(request, sites)
    
    serializer = SiteSerializer(sites, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
def sync_cart(request):
    """
    Sync the entire cart array for the user.
    Payload: { "user_id": "...", "cart": [ { "site_code": "..." }, ... ] }
    """
    user_id = request.data.get("user_id") or request.data.get("email", "")
    user_id = _normalize_user_id(user_id)
    cart_items = request.data.get("cart", [])
    
    if not user_id:
        return Response({"error": "user_id is required"}, status=400)
    
    if not isinstance(cart_items, list):
        return Response({"error": "cart must be a list"}, status=400)
        
    site_codes = []
    for item in cart_items:
        if isinstance(item, dict) and "site_code" in item:
            site_codes.append(item["site_code"])
        elif isinstance(item, str):
            site_codes.append(item)
            
    # Deduplicate while preserving order
    unique_codes = list(dict.fromkeys(site_codes))

    carts_collection.update_one(
        {"user_id": user_id},
        {"$set": {"sites": unique_codes}},
        upsert=True
    )
    
    return Response({
        "message": "Cart synchronized",
        "total": len(unique_codes)
    })
