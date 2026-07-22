import re
from datetime import datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
from bson import ObjectId
from listings.mongo import site_collection, booking_collection, site_images_collection, drafts_collection
from listings.utils import generate_site_code
from api.views.utils import normalize_image, hydrate_sites
from api.serializers import SiteSerializer

@api_view(['GET'])
def approved_sites_api(request):
    page = int(request.GET.get("page", 1))
    limit = int(request.GET.get("limit", 9))
    skip = (page - 1) * limit

    total = site_collection.count_documents(
        {"status": "approved", "is_deleted": {"$ne": True}}
    )

    cursor = (
        site_collection
        .find({"status": "approved", "is_deleted": {"$ne": True}})
        .skip(skip)
        .limit(limit)
    )

    sites = list(cursor)
    sites = hydrate_sites(request, sites)

    serializer = SiteSerializer(sites, many=True)

    return Response({
        "results": serializer.data,
        "total": total,
        "page": page,
        "limit": limit
    })

@api_view(['GET'])
def filter_sites_api(request):
    # ── Base filter: only show approved, non-deleted sites ──
    query = {"status": "approved", "is_deleted": {"$ne": True}}

    # ── Extract all filter parameters from the request ──
    location = request.GET.get("location")
    search = request.GET.get("search")
    min_price = request.GET.get("min_price")
    max_price = request.GET.get("max_price")
    min_area = request.GET.get("min_area")
    max_area = request.GET.get("max_area")
    facing = request.GET.get("facing")
    site_code = request.GET.get("site_code")
    sort = request.GET.get("sort")
    is_layout = request.GET.get("is_layout")
    boost_location = request.GET.get("boost_location", "").strip()
    page = int(request.GET.get("page", 1))

    # ── CACHING: Default Homepage ──
    has_filters = any([location, search, min_price, max_price, min_area, max_area, facing, site_code, is_layout])
    has_sort = bool(sort)
    has_boost = bool(boost_location)
    is_default_query = not has_filters and not has_sort and not has_boost and page == 1

    if is_default_query:
        from django.core.cache import cache
        cached_response = cache.get("default_homepage_sites")
        if cached_response:
            return Response(cached_response)

    # ── Build the $match filter query ──
    # IMPORTANT: In aggregation pipelines, we cannot use compiled Python
    # regex objects (re.compile). We must use MongoDB's {"$regex": ..., "$options": ...}
    # dict syntax instead. This is different from the cursor-based .find() API.
    if location:
        location_list = [l.strip() for l in location.split(",") if l.strip()]
        if location_list:
            # Case-insensitive exact match for each location using regex alternation
            regex_pattern = "^(" + "|".join([re.escape(l) for l in location_list]) + ")$"
            query["location"] = {"$regex": regex_pattern, "$options": "i"}

    if site_code:
        query["site_code"] = {"$regex": site_code, "$options": "i"}

    if facing:
        facing_list = [f.strip() for f in facing.split(",") if f.strip()]
        if facing_list:
            regex_pattern = "^(" + "|".join([re.escape(f) for f in facing_list]) + ")$"
            query["facing"] = {"$regex": regex_pattern, "$options": "i"}

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"landmark": {"$regex": search, "$options": "i"}},
            {"site_code": {"$regex": search, "$options": "i"}},
            {"layout_name": {"$regex": search, "$options": "i"}},
        ]

    if is_layout and is_layout.lower() == "true":
        query["is_layout"] = True

    if min_price or max_price:
        query["price"] = {}
        if min_price:
            query["price"]["$gte"] = int(min_price)
        if max_price:
            query["price"]["$lte"] = int(max_price)

    if min_area or max_area:
        query["area"] = {}
        if min_area:
            query["area"]["$gte"] = int(min_area)
        if max_area:
            query["area"]["$lte"] = int(max_area)

    # ── Pagination ──
    page = int(request.GET.get("page", 1))
    limit = int(request.GET.get("limit", 12))
    skip_val = (page - 1) * limit

    # ── Total count (for frontend "X properties found" display) ──
    total = site_collection.count_documents(query)

    # ── Build the Aggregation Pipeline ──
    # We always use an aggregation pipeline (even without boosting) for
    # consistency and future extensibility. The pipeline stages are:
    #   1. $match  — apply all user filters
    #   2. $addFields (optional) — inject boost_score for personalization
    #   3. $sort   — order results by boost_score or explicit sort
    #   4. $skip   — pagination offset
    #   5. $limit  — page size
    pipeline = [{"$match": query}]

    # ── Determine sort order ──
    if sort == "price_low":
        # User explicitly chose price ascending — respect this over boosting
        pipeline.append({"$sort": {"price": 1, "_id": 1}})
    elif sort == "price_high":
        # User explicitly chose price descending — respect this over boosting
        pipeline.append({"$sort": {"price": -1, "_id": 1}})
    elif boost_location:
        # PERSONALIZATION: No explicit sort requested, and we have a
        # preferred location from the user's browsing history.
        # Inject a computed field that scores matching properties higher.
        # Uses case-insensitive regex match via $regexMatch for robustness.
        pipeline.append({
            "$addFields": {
                "boost_score": {
                    "$cond": {
                        "if": {
                            "$regexMatch": {
                                "input": {"$ifNull": ["$location", ""]},
                                "regex": f"^{re.escape(boost_location)}$",
                                "options": "i"
                            }
                        },
                        "then": 1,
                        "else": 0
                    }
                }
            }
        })
        # Sort boosted properties first, then by recency within each group
        pipeline.append({"$sort": {"boost_score": -1, "created_at": -1, "_id": 1}})
    else:
        # Default sort: newest first (no boosting, no explicit sort)
        pipeline.append({"$sort": {"created_at": -1, "_id": 1}})

    # ── Pagination stages ──
    pipeline.append({"$skip": skip_val})
    pipeline.append({"$limit": limit})

    # ── Execute pipeline and hydrate results ──
    sites = hydrate_sites(request, list(site_collection.aggregate(pipeline)))

    serializer = SiteSerializer(sites, many=True)
    
    response_data = {
        "results": serializer.data,
        "total": total,
        "page": page,
        "limit": limit
    }

    if is_default_query:
        from django.core.cache import cache
        cache.set("default_homepage_sites", response_data, 300) # 5 minutes cache

    return Response(response_data)

@api_view(['GET'])
def my_sites_api(request):
    user_id = request.GET.get("user_id")
    owner = request.GET.get("owner")
    
    if not user_id and not owner:
        return Response({"error": "User ID or Owner required"}, status=400)
        
    query = {}
    if user_id and owner:
        query["$or"] = [{"user_id": user_id}, {"owner": {"$regex": f"^{owner}$", "$options": "i"}}]
    elif user_id:
        query["user_id"] = user_id
    else:
        query["owner"] = {"$regex": f"^{owner}$", "$options": "i"}
        
    # Exclude soft-deleted sites
    query["is_deleted"] = {"$ne": True}

    sites = hydrate_sites(request, list(site_collection.find(query).sort("created_at", -1)))

    from .serializers import SiteSerializer
    serializer = SiteSerializer(sites, many=True)
    return Response(serializer.data)

@csrf_exempt
@api_view(['POST'])
def create_site_api(request):
    try:
        name = request.POST.get("name", "Site")
        location = request.POST.get("location")
        price = request.POST.get("price")
        area = request.POST.get("area")
        owner = request.POST.get("owner")
        dimension = request.POST.get("dimension", "")
        facing = request.POST.get("facing", "")
        youtube_url = request.POST.get("youtube_url", "")
        
        lat_str = request.POST.get("latitude", "")
        lng_str = request.POST.get("longitude", "")
        
        try:
            latitude = float(lat_str) if lat_str else None
            longitude = float(lng_str) if lng_str else None
        except ValueError:
            return Response({"error": "Invalid GPS coordinates format"}, status=400)
        
        # For authenticated users, grab user info (frontend passes user_id or email)
        # Authenticated user
        user_id = request.POST.get("user_id", "")
        
        from listings.mongo import locations_collection, site_images_collection
        
        # 1. Normalize Location
        loc_doc = locations_collection.find_one({"city": location, "area": location})
        if not loc_doc:
            loc_result = locations_collection.insert_one({"city": location, "area": location})
            location_id = str(loc_result.inserted_id)
        else:
            location_id = str(loc_doc["_id"])
            
        # 2. Duplicate Check
        if user_id and dimension:
            existing = site_collection.find_one({
                "user_id": user_id,
                "dimension": dimension,
                "location_id": location_id,
                "is_deleted": {"$ne": True}
            })
            if existing:
                return Response({"error": "You have already uploaded a site with this dimension in this location."}, status=400)
                
        site_code = generate_site_code()

        # Booleans can be passed as "true" / "false" strings
        def get_bool(key):
            val = request.POST.get(key, "false").lower()
            return val in ["true", "1", "yes"]
            
        site_data = {
            "site_code": site_code,
            "name": name,
            "location_id": location_id,
            "price": int(price) if price else 0,
            "dimension": dimension,
            "facing": facing,
            "status": request.POST.get("status", "pending"),  # Usually pending initial upload
            "youtube_url": youtube_url,
            "user_id": user_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.now(),
            "is_deleted": False,
            "latitude": latitude,
            "longitude": longitude,
            
            # Additional strings
            "road_width": request.POST.get("road_width", ""),
            "landmark": request.POST.get("landmark", ""),
            
            # Booleans: Specs
            "corner_site": get_bool("corner_site"),
            "boundary_marked": get_bool("boundary_marked"),
            "levelled_land": get_bool("levelled_land"),
            
            # Booleans: Commerce
            "negotiable": get_bool("negotiable"),
            "loan_facility": get_bool("loan_facility"),
            
            # Booleans: Legal & Approval
            "bbmp_approved": get_bool("bbmp_approved"),
            "a_khata": get_bool("a_khata"),
            "clear_title": get_bool("clear_title"),
            "bank_loan_approved": get_bool("bank_loan_approved"),
            "layout_approved": get_bool("layout_approved"),
            
            # Booleans: Utilities
            "borewell_water": get_bool("borewell_water"),
            "electricity_nearby": get_bool("electricity_nearby"),
            "drainage_connection": get_bool("drainage_connection"),
            "asphalt_road_access": get_bool("asphalt_road_access"),
            
            # Layout specific
            "is_layout": get_bool("is_layout"),
            "layout_name": request.POST.get("layout_name", ""),
        }

        if area:
            site_data["area"] = int(area)

        if owner:
            site_data["owner"] = owner
            
        description = request.POST.get("description")
        if description:
            site_data["description"] = description

        # ✅ SAVE MULTIPLE IMAGES PROPERLY IN NORMALIZED COLLECTION
        images = request.FILES.getlist("images")
        
        for img in images:
            path = default_storage.save(f"sites/{img.name}", img)
            site_images_collection.insert_one({
                "site_code": site_code,
                "image_url": path,
                "created_at": datetime.now()
            })

        site_collection.insert_one(site_data)

        return Response(
            {"message": "Site submitted for approval"},
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['POST'])
def save_draft_api(request):
    """Save partial form data as a draft for lead tracking."""
    try:
        user_id = request.data.get("user_id") or "anonymous"
        phone = request.data.get("phone", "Unknown")
        name = request.data.get("name", "Unknown")
        form_data = request.data.get("form_data", {})
        
        # Upsert based on phone number or user_id
        drafts_collection.update_one(
            {"phone": phone},
            {"$set": {
                "user_id": user_id,
                "name": name,
                "form_data": form_data,
                "last_updated": datetime.now()
            }},
            upsert=True
        )
        return Response({"status": "draft saved"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['PUT'])
def update_site_by_code_api(request, site_code):
    data = request.data
    update_data = {}

    allowed_fields = [
        "name", "location", "area", "description",
        "price", "owner", "status",
        "dimension", "facing", "road_width", "landmark",
        "corner_site", "boundary_marked", "levelled_land",
        "negotiable", "loan_facility", 
        "bbmp_approved", "a_khata", "clear_title", "bank_loan_approved", "layout_approved",
        "borewell_water", "electricity_nearby", "drainage_connection", "asphalt_road_access"
    ]

    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    if not update_data:
        return Response(
            {"error": "No valid fields to update"},
            status=400
        )

    result = site_collection.update_one(
        {"site_code": site_code},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        return Response(
            {"error": "Site not found"},
            status=404
        )

    site = site_collection.find_one({"site_code": site_code})
    site = hydrate_sites(request, [site])[0]

    serializer = SiteSerializer(site)
    return Response(serializer.data)

@api_view(['DELETE'])
def delete_site_by_code_api(request, site_code):
    result = site_collection.update_one(
        {"site_code": site_code},
        {"$set": {"is_deleted": True}}
    )

    if result.matched_count == 0:
        return Response(
            {"error": "Site not found"},
            status=404
        )

    return Response(
        {"message": "Site deleted successfully"},
        status=200
    )

@api_view(['GET'])
def site_detail_by_code_api(request, site_code):
    site = site_collection.find_one({
        "site_code": site_code,
        "is_deleted": {"$ne": True}
    })

    if not site:
        return Response(
            {"error": "Site not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    site = hydrate_sites(request, [site])[0]

    serializer = SiteSerializer(site)
    return Response(serializer.data)

def admin_hub_page(request):
    """Main admin dashboard with summary statistics."""
    pending_visits = booking_collection.count_documents({"status": "pending"})
    pending_sites = site_collection.count_documents({"status": "pending", "is_deleted": {"$ne": True}})
    active_agents = agents_collection.count_documents({"is_active": {"$ne": False}})
    total_bookings = booking_collection.count_documents({})

    recent_bookings = list(
        booking_collection.find({"status": "pending"}).sort("created_at", -1).limit(8)
    )
    for b in recent_bookings:
        b["id"] = str(b["_id"])
        del b["_id"]

    return render(request, "admin_hub.html", {
        "pending_visits": pending_visits,
        "pending_sites": pending_sites,
        "active_agents": active_agents,
        "total_bookings": total_bookings,
        "recent_bookings": recent_bookings,
    })

def admin_sites_pending_page(request):
    """Show all sites with dynamic filtering for admin review."""
    message = request.GET.get("msg", "")

    # ── Filters from GET params ──────────────────────────
    status_filter = request.GET.get("status", "pending")   # default: pending
    search_query  = request.GET.get("q", "").strip()
    location_filter = request.GET.get("location", "").strip()

    # ── Build MongoDB query ──────────────────────────────
    query = {"is_deleted": {"$ne": True}}
    
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if search_query:
        query["$or"] = [
            {"name": {"$regex": search_query, "$options": "i"}},
            {"owner": {"$regex": search_query, "$options": "i"}},
            {"uploaded_phone": {"$regex": search_query, "$options": "i"}},
            {"site_code": {"$regex": search_query, "$options": "i"}},
        ]

    if location_filter:
        query["location"] = {"$regex": location_filter, "$options": "i"}

    # ── Pagination ───────────────────────────────────────
    try:
        page = int(request.GET.get("page", 1))
        if page < 1: page = 1
    except ValueError:
        page = 1
    page_size = 50

    total_items = site_collection.count_documents(query)
    import math
    total_pages = math.ceil(total_items / page_size) if total_items > 0 else 1

    sites_cursor = site_collection.find(query).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size)
    sites = []
    from listings.mongo import site_images_collection
    
    for s in sites_cursor:
        s["id"] = str(s["_id"])
        del s["_id"]
        
        # Attach images
        site_images = list(site_images_collection.find({"site_code": s.get("site_code", "")}))
        # Assuming MEDIA_URL is /media/ and image_url is just the relative path
        s["images"] = [f"/media/{img['image_url']}" if not img['image_url'].startswith('http') else img['image_url'] for img in site_images]
        
        sites.append(s)
        
    # ── Summary counts for tabs ──────────────────────────
    base_query = {"is_deleted": {"$ne": True}}
    counts = {
        "all":       site_collection.count_documents(base_query),
        "pending":   site_collection.count_documents({**base_query, "status": "pending"}),
        "approved":  site_collection.count_documents({**base_query, "status": "approved"}),
        "rejected":  site_collection.count_documents({**base_query, "status": "rejected"}),
    }

    tab_list = [
        ("pending",  "Pending",  "⏳"),
        ("approved", "Approved", "✅"),
        ("rejected", "Rejected", "❌"),
        ("all",      "All",      "📋"),
    ]

    return render(request, "admin_sites_pending.html", {
        "sites": sites,
        "features": SITE_FEATURES,
        "message": message,
        "counts": counts,
        "tab_list": tab_list,
        "status_filter": status_filter,
        "search_query": search_query,
        "location_filter": location_filter,
        "current_page": page,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_previous": page > 1,
        "total_filtered": total_items,
    })

def admin_site_review_page(request, site_code):
    """Render a dedicated full-page view for a single site to approve/reject."""
    site = site_collection.find_one({"site_code": site_code, "is_deleted": {"$ne": True}})
    if not site:
        from django.http import HttpResponseNotFound
        return HttpResponseNotFound("Site not found")

    site["id"] = str(site["_id"])
    del site["_id"]

    from listings.mongo import site_images_collection
    site_images = list(site_images_collection.find({"site_code": site_code}))
    
    # Retain the full image object for deleting, but add the full URL for rendering
    for img in site_images:
        img["full_url"] = f"/media/{img['image_url']}" if not img['image_url'].startswith('http') else img['image_url']
        
    site["images_raw"] = site_images
    site["images"] = [img["full_url"] for img in site_images]

    # Calculate Next and Prev site codes for easy navigation
    status = site.get("status", "pending")
    all_sites = list(site_collection.find({"status": status, "is_deleted": {"$ne": True}}, {"site_code": 1}).sort("created_at", -1))
    site_codes = [s.get("site_code") for s in all_sites if s.get("site_code")]
    
    prev_site = None
    next_site = None
    if site_code in site_codes:
        idx = site_codes.index(site_code)
        if idx > 0:
            prev_site = site_codes[idx - 1]  # Newer site
        if idx < len(site_codes) - 1:
            next_site = site_codes[idx + 1]  # Older site

    return render(request, "admin_site_detail.html", {
        "site": site,
        "prev_site": prev_site,
        "next_site": next_site,
        "features": SITE_FEATURES,
    })

def admin_approve_site(request):
    """POST: Approve or reject a pending site."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/sites/pending/")

    site_code = request.POST.get("site_code")
    action = request.POST.get("action")  # 'approved' or 'rejected'

    if not site_code or action not in ("approved", "rejected"):
        return HttpResponseRedirect("/admin/sites/pending/?msg=Invalid+action")

    site_collection.update_one(
        {"site_code": site_code},
        {"$set": {"status": action}}
    )
    return HttpResponseRedirect(f"/admin/sites/pending/?msg=Site+{site_code}+marked+as+{action}")

def admin_upload_site_page(request):
    """GET: Show site upload form. POST: Create site on behalf of a user."""
    message = request.GET.get("msg", "")
    error = request.GET.get("err", "")

    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        location = request.POST.get("location", "").strip()
        price = request.POST.get("price")
        area = request.POST.get("area")
        plot_size = request.POST.get("plot_size", "")
        dimension = request.POST.get("dimension", "")
        facing = request.POST.get("facing", "")
        ownership_type = request.POST.get("ownership_type", "")
        availability = request.POST.get("availability", "")
        road_width = request.POST.get("road_width", "")
        landmark = request.POST.get("landmark", "")
        distance_to_main_road = request.POST.get("distance_to_main_road", "")
        zoning_type = request.POST.get("zoning_type", "")
        category = request.POST.get("category", "")
        description = request.POST.get("description", "")
        owner = request.POST.get("owner", "").strip()
        uploaded_phone = request.POST.get("uploaded_phone", "").strip()
        site_status = request.POST.get("status", "pending")

        if not name or not location or not price or not owner or not uploaded_phone:
            return HttpResponseRedirect("/admin/sites/upload/?err=Please+fill+all+required+fields")

        from listings.utils import generate_site_code
        site_code = generate_site_code()

        features = {f["key"]: (request.POST.get(f["key"]) == "true") for f in SITE_FEATURES}

        site_doc = {
            "site_code": site_code,
            "name": name,
            "location": location,
            "price": float(price),
            "area": float(area) if area else None,
            "plot_size": plot_size,
            "dimension": dimension,
            "facing": facing,
            "ownership_type": ownership_type,
            "availability": availability,
            "road_width": road_width,
            "landmark": landmark,
            "distance_to_main_road": distance_to_main_road,
            "zoning_type": zoning_type,
            "category": category,
            "description": description,
            "owner": owner,
            "uploaded_phone": uploaded_phone,
            "status": site_status,
            "is_deleted": False,
            "created_at": datetime.now(),
            **features,
        }
        site_collection.insert_one(site_doc)
        return HttpResponseRedirect(f"/admin/sites/upload/?msg=Site+{site_code}+uploaded+successfully")

    return render(request, "admin_upload_site.html", {
        "features": SITE_FEATURES,
        "message": message,
        "error": error,
    })

def admin_edit_site(request):
    """POST: Edit a pending site's details, optionally approve immediately."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/sites/pending/")

    site_code   = request.POST.get("site_code", "").strip()
    action      = request.POST.get("action", "save")  # 'save' or 'save_approve'
    name        = request.POST.get("name", "").strip()
    location    = request.POST.get("location", "").strip()
    price       = request.POST.get("price")
    area        = request.POST.get("area")
    plot_size   = request.POST.get("plot_size", "")
    dimension   = request.POST.get("dimension", "")
    facing      = request.POST.get("facing", "")
    ownership_type = request.POST.get("ownership_type", "")
    availability = request.POST.get("availability", "")
    road_width  = request.POST.get("road_width", "")
    landmark    = request.POST.get("landmark", "")
    distance_to_main_road = request.POST.get("distance_to_main_road", "")
    zoning_type = request.POST.get("zoning_type", "")
    category    = request.POST.get("category", "")
    description = request.POST.get("description", "")
    admin_notes = request.POST.get("admin_notes", "")
    youtube_url = request.POST.get("youtube_url", "")

    if not site_code:
        return HttpResponseRedirect("/admin/sites/pending/?msg=Invalid+site")

    update_data = {
        "name": name,
        "location": location,
        "plot_size": plot_size,
        "dimension": dimension,
        "facing": facing,
        "ownership_type": ownership_type,
        "availability": availability,
        "road_width": road_width,
        "landmark": landmark,
        "distance_to_main_road": distance_to_main_road,
        "zoning_type": zoning_type,
        "category": category,
        "description": description,
        "admin_notes": admin_notes,
        "youtube_url": youtube_url,
    }
    if price:
        update_data["price"] = float(price)
    if area:
        update_data["area"] = float(area)

    # Helper to parse boolean from checkbox string
    def get_bool(key):
        return request.POST.get(key) == "true"

    # Dynamically extract all features configured in SITE_FEATURES
    for feature in SITE_FEATURES:
        update_data[feature["key"]] = get_bool(feature["key"])

    if action == "save_approve" or action == "approved":
        update_data["status"] = "approved"
    elif action == "reject" or action == "rejected":
        update_data["status"] = "rejected"

    site_collection.update_one(
        {"site_code": site_code},
        {"$set": update_data}
    )

    next_url = request.POST.get("next")
    if next_url:
        return HttpResponseRedirect(next_url)
        
    return HttpResponseRedirect(f"/admin/sites/pending/?msg=Site+{site_code}+updated+successfully")

def admin_user_profile(request):
    """GET ?phone=xxx  — Returns user profile, bookings, sites, and visits."""
    from django.http import JsonResponse
    phone = request.GET.get("phone", "").strip()
    if not phone:
        return JsonResponse({"error": "Phone is required"}, status=400)

    from listings.mongo import user_profiles_collection

    # Profile
    profile = user_profiles_collection.find_one({"phone": phone}) or {}
    if profile:
        profile["id"] = str(profile.pop("_id", ""))

    # Bookings by this phone
    bookings = list(booking_collection.find({"phone": phone}).sort("created_at", -1).limit(10))
    for b in bookings:
        b["id"] = str(b["_id"])
        del b["_id"]

    # Sites uploaded by this phone
    sites = list(site_collection.find({"uploaded_phone": phone}).sort("created_at", -1).limit(10))
    for s in sites:
        s["id"] = str(s["_id"])
        del s["_id"]

    # Visits (from visits_collection) by this phone or user
    from listings.mongo import visits_collection
    visits = []
    if profile.get("email"):
        visits = list(visits_collection.find({"user_id": profile.get("email")}).sort("created_at", -1).limit(10))
        for v in visits:
            v["id"] = str(v["_id"])
            del v["_id"]

    return JsonResponse({
        "profile": profile,
        "bookings": bookings,
        "sites": sites,
        "visits": visits,
    })


@api_view(['POST'])
def delete_site_image_api(request):
    """
    Remove one image from site_images_collection and from the site's legacy images array.
    Payload: { site_code, image_url }
    """
    from listings.mongo import site_images_collection

    site_code = request.data.get("site_code", "").strip()
    image_url = request.data.get("image_url", "").strip()

    if not site_code or not image_url:
        return Response({"error": "site_code and image_url are required"}, status=400)

    # Delete from normalised images collection
    site_images_collection.delete_many({"site_code": site_code, "image_url": image_url})

    # Also remove from legacy images[] array on site doc
    from listings.mongo import site_collection
    site_collection.update_one(
        {"site_code": site_code},
        {"$pull": {"images": image_url}}
    )

    return Response({"message": "Image deleted", "site_code": site_code})
