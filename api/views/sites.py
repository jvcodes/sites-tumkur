import os
import re
from datetime import datetime
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import render
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
from bson import ObjectId
from listings.mongo import site_collection, booking_collection, site_images_collection, drafts_collection
from listings.utils import generate_site_code
from api.views.utils import normalize_image, hydrate_sites
from api.serializers import SiteSerializer

SITE_FEATURES = [
    {"key": "corner_site", "label": "Corner Site"},
    {"key": "boundary_marked", "label": "Boundary Marked"},
    {"key": "levelled_land", "label": "Levelled Land"},
    {"key": "negotiable", "label": "Price Negotiable"},
    {"key": "loan_facility", "label": "Loan Facility"},
    {"key": "tuda_approved", "label": "TUDA Approved"},
    {"key": "a_khata", "label": "A-Khata"},
    {"key": "clear_title", "label": "Clear Title"},
    {"key": "bank_loan_approved", "label": "Bank Loan Approved"},
    {"key": "layout_approved", "label": "Layout Approved"},
    {"key": "borewell_water", "label": "Borewell Water"},
    {"key": "electricity_nearby", "label": "Electricity Nearby"},
    {"key": "drainage_connection", "label": "Drainage Connection"},
    {"key": "asphalt_road_access", "label": "Asphalt Road Access"},
]

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

    # ── Test vs Real Data Isolation (Controlled via backend settings / env) ──
    from django.conf import settings
    show_test_data = getattr(settings, 'SHOW_TEST_DATA', True)
    is_prod = os.environ.get("ENVIRONMENT", "").lower() == "production"
    real_only = request.GET.get("real_only", "").lower() in ["true", "1"]

    if not show_test_data or is_prod or real_only:
        # Strictly serve ONLY authentic real properties (hide mock/seed data)
        query["is_test"] = {"$ne": True}

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
    has_video = request.GET.get("has_video")
    boost_location = request.GET.get("boost_location", "").strip()
    page = int(request.GET.get("page", 1))

    # ── CACHING: Default Homepage ──
    has_filters = any([location, search, min_price, max_price, min_area, max_area, facing, site_code, is_layout, has_video, real_only])
    has_sort = bool(sort)
    has_boost = bool(boost_location)
    is_default_query = not has_filters and not has_sort and not has_boost and page == 1

    if is_default_query:
        from django.core.cache import cache
        cache_key = "default_homepage_sites_real" if (is_prod or real_only or not show_test_data) else "default_homepage_sites_all"
        cached_response = cache.get(cache_key)
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

    if has_video and has_video.lower() == "true":
        query["youtube_url"] = {"$exists": True, "$ne": "", "$nin": [None, ""]}

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
    print("DEBUG PIPELINE:", pipeline)
    sites = hydrate_sites(request, list(site_collection.aggregate(pipeline)))

    serializer = SiteSerializer(sites, many=True)
    
    print("DEBUG boost_location:", boost_location)
    print("DEBUG first 3 sites returned:", [(s.get("site_code"), s.get("location")) for s in sites[:3]])
    
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

    from api.serializers import SiteSerializer
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
            "is_test": get_bool("is_test"),  # Defaults to False for authentic properties
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
            "tuda_approved": get_bool("tuda_approved") if "tuda_approved" in request.POST else get_bool("bbmp_approved"),
            "bbmp_approved": get_bool("tuda_approved") if "tuda_approved" in request.POST else get_bool("bbmp_approved"),
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

        # Parse nearby_landmarks with distance
        nearby_landmarks_raw = request.POST.get("nearby_landmarks")
        if nearby_landmarks_raw:
            try:
                import json
                if isinstance(nearby_landmarks_raw, str):
                    parsed_landmarks = json.loads(nearby_landmarks_raw)
                else:
                    parsed_landmarks = nearby_landmarks_raw
                if isinstance(parsed_landmarks, list):
                    site_data["nearby_landmarks"] = [
                        {
                            "landmark": str(item.get("landmark", "")).strip(),
                            "distance_km": float(item.get("distance_km", 0)) if item.get("distance_km") is not None and str(item.get("distance_km")).strip() != "" else None
                        }
                        for item in parsed_landmarks
                        if item.get("landmark")
                    ]
            except Exception:
                pass

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
            {"message": "Site submitted for approval", "site_code": site_code},
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
        "tuda_approved", "bbmp_approved", "a_khata", "clear_title", "bank_loan_approved", "layout_approved",
        "borewell_water", "electricity_nearby", "drainage_connection", "asphalt_road_access",
        "nearby_landmarks", "youtube_url", "latitude", "longitude", "uploaded_phone",
        "ownership_type", "availability", "zoning_type", "category"
    ]

    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    # Safe float conversions
    for float_field in ("price", "area", "latitude", "longitude"):
        if float_field in update_data:
            val = update_data[float_field]
            if val is not None and str(val).strip() != "":
                try:
                    update_data[float_field] = float(val)
                except (ValueError, TypeError):
                    pass
            else:
                update_data[float_field] = None

    # Safe boolean conversions
    boolean_fields = [
        "corner_site", "boundary_marked", "levelled_land",
        "negotiable", "loan_facility",
        "a_khata", "clear_title", "bank_loan_approved", "layout_approved",
        "borewell_water", "electricity_nearby", "drainage_connection", "asphalt_road_access"
    ]
    for b_field in boolean_fields:
        if b_field in update_data:
            update_data[b_field] = bool(update_data[b_field])

    if "tuda_approved" in data:
        update_data["tuda_approved"] = bool(data["tuda_approved"])
        update_data["bbmp_approved"] = bool(data["tuda_approved"])
    elif "bbmp_approved" in data:
        update_data["tuda_approved"] = bool(data["bbmp_approved"])
        update_data["bbmp_approved"] = bool(data["bbmp_approved"])

    if "nearby_landmarks" in data:
        landmarks_val = data["nearby_landmarks"]
        if isinstance(landmarks_val, str):
            try:
                import json
                landmarks_val = json.loads(landmarks_val)
            except Exception:
                landmarks_val = []
        if isinstance(landmarks_val, list):
            update_data["nearby_landmarks"] = [
                {
                    "landmark": str(item.get("landmark", "")).strip(),
                    "distance_km": float(item.get("distance_km", 0)) if item.get("distance_km") is not None and str(item.get("distance_km")).strip() != "" else None
                }
                for item in landmarks_val
                if item.get("landmark")
            ]

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
    site = site_collection.find_one({
        "site_code": site_code,
        "is_deleted": {"$ne": True}
    })

    if not site:
        return Response(
            {"error": "Site not found"},
            status=404
        )

    # Ownership verification: if site has user_id or owner, check authorization
    requester_id = (request.data.get("user_id") if hasattr(request, "data") and isinstance(request.data, dict) else None) or request.GET.get("user_id")
    if not requester_id and hasattr(request, "user") and request.user.is_authenticated:
        requester_id = request.user.email or request.user.username

    site_user_id = site.get("user_id")
    site_owner = site.get("owner")
    is_staff = hasattr(request, "user") and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser)

    # If site is tied to a user, enforce ownership unless admin/staff
    if (site_user_id or site_owner) and not is_staff:
        if not requester_id:
            return Response({"error": "Unauthorized: user_id is required to delete this site"}, status=403)
        req_clean = str(requester_id).strip().lower()
        allowed = []
        if site_user_id:
            allowed.append(str(site_user_id).strip().lower())
        if site_owner:
            allowed.append(str(site_owner).strip().lower())
        if req_clean not in allowed:
            return Response({"error": "Unauthorized: You cannot delete a site uploaded by another user"}, status=403)

    result = site_collection.update_one(
        {"site_code": site_code},
        {"$set": {"is_deleted": True}}
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

    # Find adjacent properties for previous / next navigation
    site_id = site.get("_id")
    prev_site = None
    next_site = None
    if site_id:
        prev_site = site_collection.find_one(
            {
                "status": "approved",
                "is_deleted": {"$ne": True},
                "_id": {"$gt": site_id}
            },
            sort=[("_id", 1)],
            projection={"site_code": 1, "name": 1, "price": 1, "location": 1}
        )
        next_site = site_collection.find_one(
            {
                "status": "approved",
                "is_deleted": {"$ne": True},
                "_id": {"$lt": site_id}
            },
            sort=[("_id", -1)],
            projection={"site_code": 1, "name": 1, "price": 1, "location": 1}
        )

    hydrated_site = hydrate_sites(request, [site])[0]

    serializer = SiteSerializer(hydrated_site)
    data = dict(serializer.data)
    data["prev_site"] = {
        "site_code": prev_site.get("site_code"),
        "name": prev_site.get("name"),
        "price": prev_site.get("price"),
        "location": prev_site.get("location")
    } if prev_site and prev_site.get("site_code") else None
    data["next_site"] = {
        "site_code": next_site.get("site_code"),
        "name": next_site.get("name"),
        "price": next_site.get("price"),
        "location": next_site.get("location")
    } if next_site and next_site.get("site_code") else None

    return Response(data)

def admin_hub_page(request):
    """Main admin dashboard with summary statistics."""
    pending_visits = booking_collection.count_documents({"status": "pending"})
    pending_sites = site_collection.count_documents({"status": "pending", "is_deleted": {"$ne": True}})
    real_sites_count = site_collection.count_documents({"is_test": {"$ne": True}, "is_deleted": {"$ne": True}})
    test_sites_count = site_collection.count_documents({"is_test": True, "is_deleted": {"$ne": True}})
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
        "real_sites_count": real_sites_count,
        "test_sites_count": test_sites_count,
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
        "sold":      site_collection.count_documents({**base_query, "status": "sold"}),
        "rejected":  site_collection.count_documents({**base_query, "status": "rejected"}),
    }

    tab_list = [
        ("pending",  "Pending",  "⏳"),
        ("approved", "Approved", "✅"),
        ("sold",     "Sold",     "🏷️"),
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

    from listings.mongo import site_images_collection, landmarks_collection
    site_images = list(site_images_collection.find({"site_code": site_code}))
    
    # Retain the full image object for deleting, with fallback to legacy images
    if not site_images:
        legacy_imgs = site.get("images") or ([site.get("image")] if site.get("image") else [])
        for l_img in legacy_imgs:
            if l_img:
                clean_img = str(l_img).strip()
                full_url = f"/media/{clean_img}" if not clean_img.startswith("http") and not clean_img.startswith("/") else clean_img
                site_images.append({
                    "site_code": site_code,
                    "image_url": clean_img,
                    "full_url": full_url
                })
    else:
        for img in site_images:
            img["full_url"] = f"/media/{img['image_url']}" if not img['image_url'].startswith('http') else img['image_url']
        
    site["images_raw"] = site_images
    site["images"] = [img["full_url"] for img in site_images]

    # Available landmarks for autocomplete / quick-pick
    available_landmarks = list(landmarks_collection.find({"is_active": {"$ne": False}}, {"name": 1, "category": 1}))
    for al in available_landmarks:
        al["id"] = str(al["_id"])

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

    message = request.GET.get("msg", "")
    return render(request, "admin_site_detail.html", {
        "site": site,
        "prev_site": prev_site,
        "next_site": next_site,
        "features": SITE_FEATURES,
        "available_landmarks": available_landmarks,
        "message": message,
    })

def admin_approve_site(request):
    """POST: Approve, reject, or mark as sold."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/sites/pending/")

    site_code = request.POST.get("site_code")
    action = request.POST.get("action")  # 'approved', 'rejected', or 'sold'

    if not site_code or action not in ("approved", "rejected", "sold"):
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

def parse_nearby_landmarks_input(request):
    """
    Parses landmark entries from form POST inputs:
    - Array format: landmark_name[] and landmark_distance[]
    - Raw multiline or JSON format from nearby_landmarks
    """
    names = request.POST.getlist("landmark_name")
    distances = request.POST.getlist("landmark_distance")
    if names:
        landmarks = []
        for idx, name in enumerate(names):
            clean_name = str(name).strip()
            if not clean_name:
                continue
            dist = None
            if idx < len(distances) and str(distances[idx]).strip():
                try:
                    dist = float(distances[idx])
                except (ValueError, TypeError):
                    dist = None
            landmarks.append({"landmark": clean_name, "distance_km": dist})
        return landmarks

    raw = request.POST.get("nearby_landmarks")
    if raw:
        if isinstance(raw, str):
            try:
                import json
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [
                        {
                            "landmark": str(item.get("landmark", "")).strip(),
                            "distance_km": float(item.get("distance_km", 0)) if item.get("distance_km") not in (None, "") else None
                        }
                        for item in parsed
                        if item.get("landmark")
                    ]
            except Exception:
                pass
            # Parse line by line "Landmark Name, 2.5"
            lines = [l.strip() for l in raw.strip().split("\n") if l.strip()]
            landmarks = []
            for line in lines:
                parts = line.split(",")
                lm_name = parts[0].strip()
                dist = None
                if len(parts) > 1:
                    try:
                        dist = float(parts[1].replace("km", "").replace("KM", "").strip())
                    except (ValueError, TypeError):
                        dist = None
                if lm_name:
                    landmarks.append({"landmark": lm_name, "distance_km": dist})
            return landmarks
    return None

def admin_edit_site(request):
    """POST: Edit a site's details, upload photos, and update status."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/sites/pending/")

    site_code   = request.POST.get("site_code", "").strip()
    action      = request.POST.get("action", "save")
    status_sel  = request.POST.get("status", "").strip().lower()
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
    owner       = request.POST.get("owner", "").strip()
    uploaded_phone = request.POST.get("uploaded_phone", "").strip()
    latitude    = request.POST.get("latitude")
    longitude   = request.POST.get("longitude")

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
        try:
            val = float(price)
            if val >= 0:
                update_data["price"] = val
        except (ValueError, TypeError):
            pass
    if area:
        try:
            val = float(area)
            if val >= 0:
                update_data["area"] = val
        except (ValueError, TypeError):
            pass

    if owner:
        update_data["owner"] = owner
    if uploaded_phone:
        update_data["uploaded_phone"] = uploaded_phone

    if latitude:
        try:
            update_data["latitude"] = float(latitude)
        except (ValueError, TypeError):
            pass
    if longitude:
        try:
            update_data["longitude"] = float(longitude)
        except (ValueError, TypeError):
            pass

    # Helper to parse boolean from checkbox string
    def get_bool(key):
        return request.POST.get(key) == "true"

    # Dynamically extract all features configured in SITE_FEATURES
    for feature in SITE_FEATURES:
        update_data[feature["key"]] = get_bool(feature["key"])

    if "tuda_approved" in update_data:
        update_data["bbmp_approved"] = update_data["tuda_approved"]

    # Nearby Landmarks
    lm_data = parse_nearby_landmarks_input(request)
    if lm_data is not None:
        update_data["nearby_landmarks"] = lm_data

    # Determine status transition
    if action in ("save_approve", "approved"):
        update_data["status"] = "approved"
    elif action in ("reject", "rejected"):
        update_data["status"] = "rejected"
    elif action == "sold":
        update_data["status"] = "sold"
    elif action == "pending":
        update_data["status"] = "pending"
    elif status_sel in ("approved", "pending", "rejected", "sold"):
        update_data["status"] = status_sel

    site_collection.update_one(
        {"site_code": site_code},
        {"$set": update_data}
    )

    # Handle optional new image uploads
    new_images = request.FILES.getlist("images")
    if new_images:
        from django.core.files.storage import default_storage
        for img in new_images:
            path = default_storage.save(f"sites/{img.name}", img)
            site_images_collection.insert_one({
                "site_code": site_code,
                "image_url": path,
                "created_at": datetime.now()
            })

    next_url = request.POST.get("next")
    msg = f"Site {site_code} updated successfully"
    if next_url:
        import urllib.parse
        delimiter = "&" if "?" in next_url else "?"
        return HttpResponseRedirect(f"{next_url}{delimiter}msg={urllib.parse.quote_plus(msg)}")

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
    from listings.mongo import site_images_collection, site_collection

    site_code = request.data.get("site_code", "").strip()
    image_url = request.data.get("image_url", "").strip()

    if not site_code or not image_url:
        return Response({"error": "site_code and image_url are required"}, status=400)

    raw_rel = image_url.replace("/media/", "") if image_url.startswith("/media/") else image_url

    # Delete from normalised images collection
    site_images_collection.delete_many({
        "site_code": site_code,
        "$or": [{"image_url": image_url}, {"image_url": raw_rel}]
    })

    # Also remove from legacy images[] array on site doc
    site_collection.update_one(
        {"site_code": site_code},
        {"$pull": {"images": {"$in": [image_url, raw_rel]}}}
    )
    # And clear single image field if it matched
    site_collection.update_one(
        {"site_code": site_code, "image": {"$in": [image_url, raw_rel]}},
        {"$set": {"image": ""}}
    )

    return Response({"message": "Image deleted", "site_code": site_code})
