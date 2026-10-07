from django.core.files.storage import default_storage
from django.conf import settings
from bson import ObjectId

# --------------------------------------------------
# 🔹 Helper: Normalize Image URL
# --------------------------------------------------
def normalize_image(request, image_path):
    if not image_path:
        return ""
    if image_path.startswith("http"):
        return image_path
        
    # Strip leading slash and /media/ if present
    path = image_path
    if path.startswith("/media/"):
        path = path[7:]
    elif path.startswith("media/"):
        path = path[6:]
        
    path = path.lstrip("/")
    
    # Get the URL from the storage backend (works for both local and GCS)
    try:
        url = default_storage.url(path)
        # In local mode, default_storage.url might just append MEDIA_URL
        if not url.startswith("http"):
            # Ensure it has a leading slash for relative paths if it doesn't already
            if not url.startswith("/"):
                url = f"/{url}"
        return url
    except Exception:
        return f"{settings.MEDIA_URL}{path}"


# --------------------------------------------------
# 🔹 Helper: Hydrate Sites with Locations and Images
# --------------------------------------------------
def hydrate_sites(request, sites):
    from listings.mongo import locations_collection, site_images_collection
    
    # 1. Fetch Locations (only for sites missing text location)
    loc_ids = []
    for s in sites:
        if not s.get("location") and s.get("location_id"):
            try:
                loc_ids.append(ObjectId(s["location_id"]))
            except:
                pass
                
    locations = {}
    if loc_ids:
        for loc in locations_collection.find({"_id": {"$in": loc_ids}}):
            locations[str(loc["_id"])] = loc.get("city", "")

    # 2. Fetch Images (skip external collection query for synthetic test/dummy sites
    # that already have embedded image URLs on the document, saving a DB round-trip)
    site_codes = [
        s.get("site_code")
        for s in sites
        if s.get("site_code") and not (s.get("is_test") and (s.get("images") or s.get("image")))
    ]
    images_map = {}
    if site_codes:
        for img in site_images_collection.find({"site_code": {"$in": site_codes}}).sort("created_at", 1):
            images_map.setdefault(img["site_code"], []).append(img["image_url"])

    for s in sites:
        s["id"] = str(s["_id"])
        s["site_code"] = s.get("site_code", "")
        s["area"] = s.get("area", 0)
        s["owner"] = s.get("owner", "")
        s["youtube_url"] = s.get("youtube_url", "")
        s["latitude"] = s.get("latitude", None)
        s["longitude"] = s.get("longitude", None)
        s["uploaded_phone"] = s.get("uploaded_phone", "")
        s["ownership_type"] = s.get("ownership_type", "")
        s["availability"] = s.get("availability", "")
        s["zoning_type"] = s.get("zoning_type", "")
        s["category"] = s.get("category", "")
        s["distance_to_main_road"] = s.get("distance_to_main_road", "")
        if "nearby_landmarks" in s:
            s["nearby_landmarks"] = s.get("nearby_landmarks") or []
        
        # Hydrate text location from location_id only if missing
        if not s.get("location") and s.get("location_id") and str(s["location_id"]) in locations:
            s["location"] = locations[str(s["location_id"])]
        
        # Hydrate images
        s_images = images_map.get(s["site_code"], [])
        
        # Backward compatibility for sites created before normalization
        legacy_images = s.get("images", [])
        if not s_images and legacy_images:
            s_images = legacy_images
            
        if s_images:
            s["image"] = normalize_image(request, s_images[0])
            s["images"] = [normalize_image(request, i) for i in s_images]
        elif s.get("image"):
            s["image"] = normalize_image(request, s["image"])
            s["images"] = [s["image"]]
        else:
            s["image"] = ""
            s["images"] = []
            
    return sites


# --------------------------------------------------
# 🔹 Helper & Decorator: Admin Hub Session Authentication
# --------------------------------------------------
def is_admin_authenticated(request):
    """
    Returns True if the current request has an authenticated Admin Hub session
    or is logged in as a Django staff/superuser.
    """
    if hasattr(request, "session") and request.session.get("is_admin_authenticated") is True:
        return True
    if hasattr(request, "user") and getattr(request.user, "is_authenticated", False):
        if getattr(request.user, "is_staff", False) or getattr(request.user, "is_superuser", False):
            return True
    return False


def admin_login_required(view_func):
    """
    Decorator that protects Django Admin Hub views (/admin/...).
    Redirects unauthenticated visitors to /admin/login/?next=<path>.
    """
    from functools import wraps
    from django.http import HttpResponseRedirect
    import urllib.parse

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not is_admin_authenticated(request):
            next_path = request.get_full_path() if hasattr(request, "get_full_path") else "/admin/hub/"
            encoded_next = urllib.parse.quote(next_path, safe="")
            return HttpResponseRedirect(f"/admin/login/?next={encoded_next}")
        return view_func(request, *args, **kwargs)

    return _wrapped_view

