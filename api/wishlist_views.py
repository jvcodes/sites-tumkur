from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from listings.mongo import db
from .views import normalize_image, hydrate_sites
from .serializers import SiteSerializer

# MongoDB Collection
wishlist_collection = db['wishlists']
site_collection = db['sites']


@api_view(['GET'])
@permission_classes([AllowAny])
def get_wishlist(request):
    """
    Get all sites in the user's wishlist.
    Uses email as user identifier (passed as query param).
    GET /api/wishlist/?email=user@gmail.com
    """
    user_id = request.GET.get("user_id") or request.GET.get("email")
    if not user_id:
        return Response([])

    import re
    if "@" not in user_id:
        digits = re.sub(r'\D', '', user_id)
        user_id = digits[-10:] if len(digits) >= 10 else digits

    wishlist_doc = wishlist_collection.find_one({"user_id": user_id})
    if not wishlist_doc or not wishlist_doc.get("sites"):
        return Response([])

    site_codes = wishlist_doc["sites"]  # List of site_codes

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
def toggle_wishlist(request):
    """
    Add or Remove a site from wishlist.
    Payload: { "email": "user@gmail.com", "site_code": "SEED-123" }
    """
    user_id = request.data.get("user_id", request.data.get("email", "")).strip()
    site_code = request.data.get("site_code", "").strip()

    if not user_id:
        return Response({"error": "user_id is required"}, status=400)
    if not site_code:
        return Response({"error": "site_code is required"}, status=400)

    import re
    if "@" not in user_id:
        digits = re.sub(r'\D', '', user_id)
        user_id = digits[-10:] if len(digits) >= 10 else digits

    # Get or create wishlist doc for this user
    wishlist_doc = wishlist_collection.find_one({"user_id": user_id})
    current_sites = wishlist_doc.get("sites", []) if wishlist_doc else []

    # Toggle
    if site_code in current_sites:
        current_sites.remove(site_code)
        action = "removed"
    else:
        current_sites.append(site_code)
        action = "added"

    # Upsert
    wishlist_collection.update_one(
        {"user_id": user_id},
        {"$set": {"sites": current_sites}},
        upsert=True
    )

    return Response({
        "message": f"Site {action} from wishlist",
        "liked": action == "added",
        "site_code": site_code,
        "total": len(current_sites),
    })
