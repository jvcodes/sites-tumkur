from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt

from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

from .serializers import SiteSerializer
from listings.mongo import site_collection, booking_collection, site_images_collection, agents_collection, drafts_collection
from listings.utils import generate_site_code

from django.core.files.storage import default_storage
from django.conf import settings
import os
import re


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
    
    # 1. Fetch Locations
    loc_ids = []
    for s in sites:
        if s.get("location_id"):
            try:
                loc_ids.append(ObjectId(s["location_id"]))
            except:
                pass
                
    locations = {}
    if loc_ids:
        for loc in locations_collection.find({"_id": {"$in": loc_ids}}):
            locations[str(loc["_id"])] = loc.get("city", "")

    # 2. Fetch Images
    site_codes = [s.get("site_code") for s in sites if s.get("site_code")]
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
        
        # Hydrate text location from location_id
        if s.get("location_id") and str(s["location_id"]) in locations:
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
# 🔹 GET: Distinct Locations from DB (Dynamic dropdown)
# --------------------------------------------------
@api_view(['GET'])
def get_locations_api(request):
    """Returns a sorted list of unique location names from approved sites."""
    from listings.mongo import locations_collection

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
    return Response({"locations": combined})


# --------------------------------------------------
# 🔹 POST: Delete a Single Site Image (Admin)
# --------------------------------------------------
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
    site_collection.update_one(
        {"site_code": site_code},
        {"$pull": {"images": image_url}}
    )

    return Response({"message": "Image deleted", "site_code": site_code})


# --------------------------------------------------
# 🔹 GET: Approved Sites
# --------------------------------------------------
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



# --------------------------------------------------
# 🔹 GET: Filter Sites + Sort (with Personalization Boosting)
# --------------------------------------------------
# This endpoint powers the homepage property grid. It supports:
#   - Multi-filter querying (location, price, area, facing, search, is_layout)
#   - Explicit sorting (price_low, price_high)
#   - Personalization boosting via `boost_location` param
#
# PERSONALIZATION STRATEGY (Hybrid Boosting System):
# When a user browses a property, the frontend saves that property's
# location to localStorage. On subsequent homepage loads (without active
# filters or explicit sorts), the frontend sends `boost_location=<loc>`
# to this endpoint. We use a MongoDB Aggregation Pipeline to assign a
# `boost_score` of 1 to properties matching the boosted location and 0
# to everything else. We then sort by boost_score DESC, created_at DESC.
# This pushes the user's preferred area to the top without hiding other
# properties — they simply appear further down the grid.
#
# EDGE CASES HANDLED:
# - If boost_location is empty or missing, no boosting occurs.
# - If the user applies an explicit sort (price_low/price_high), boosting
#   is disabled to respect the user's manual intent.
# - Compiled regex objects are NOT used inside $match in an aggregation
#   pipeline because pymongo's $regex syntax is required instead. We
#   convert them to {"$regex": ..., "$options": "i"} dicts.
# --------------------------------------------------
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


# --------------------------------------------------
# 🔹 GET: My Sites (User Profile)
# --------------------------------------------------
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


# --------------------------------------------------
# 🔹 POST: Create Site (Image Upload FIXED)
# --------------------------------------------------
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


# --------------------------------------------------
# 🔹 PUT: Update Site
# --------------------------------------------------
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


# --------------------------------------------------
# 🔹 DELETE: Site
# --------------------------------------------------
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


# --------------------------------------------------
# 🔹 BOOKINGS
# --------------------------------------------------
@csrf_exempt
@api_view(['POST'])
def create_booking_api(request):
    data = request.data

    name = data.get("name")
    phone = data.get("phone")
    date = data.get("date")
    time_str = data.get("time")
    sites = data.get("sites")

    if not name or not phone or not date or not time_str or not sites:
        return Response(
            {"error": "Missing booking details including time"},
            status=400
        )

    booking = {
        "name": name,
        "phone": phone,
        "email": data.get("email", ""),
        "date": date,
        "time": time_str,
        "sites": sites,
        "status": "pending",
        "created_at": datetime.now()
    }

    booking_collection.insert_one(booking)

    # Upsert user profile to ensure phone is recorded as primary ID
    from listings.mongo import user_profiles_collection
    
    # If the frontend passes email, link it to the profile
    email = data.get("email")
    if email:
        user_profiles_collection.update_one(
            {"email": email},
            {"$set": {"phone": phone, "name": name}},
            upsert=True
        )
    else:
        # Fallback if unauthenticated: just ensure a profile with this phone exists
        user_profiles_collection.update_one(
            {"phone": phone},
            {"$set": {"name": name}},
            upsert=True
        )

    # ---------------------------------------------------------
    # NOTIFICATIONS
    # ---------------------------------------------------------
    print(f"[NOTIFICATION] WhatsApp message sent to {phone}: 'Hi {name}, your visit for {len(sites)} sites on {date} at {time_str} is requested. We will confirm shortly.'")
    
    if email:
        from django.core.mail import send_mail
        from django.conf import settings
        
        subject = f"TumkurSites: Visit Request Confirmed for {date}"
        message = f"Hi {name},\n\nYour visit for {len(sites)} sites on {date} at {time_str} is requested. We will call you at {phone} to confirm the details shortly.\n\nThank you,\nTumkurSites Team"
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL if hasattr(settings, 'DEFAULT_FROM_EMAIL') else 'noreply@tumkursites.com',
                [email],
                fail_silently=True,
            )
            print(f"[NOTIFICATION] Email sent successfully to {email}")
        except Exception as e:
            print(f"[NOTIFICATION] Failed to send email to {email}: {e}")
    # ---------------------------------------------------------

    return Response(
        {"message": "Visiting request submitted"},
        status=201
    )

@api_view(['GET'])
def my_bookings_api(request):
    phone = request.GET.get("phone")
    email = request.GET.get("email")
    user_id = request.GET.get("user_id")
    
    if user_id:
        if "@" in user_id:
            email = user_id
        else:
            phone = user_id
            
    import re
    if phone:
        digits = re.sub(r'\D', '', phone)
        phone = digits[-10:] if len(digits) >= 10 else digits
            
    if not phone and not email:
        return Response({"error": "Phone number or email required"}, status=400)
        
    from listings.mongo import user_profiles_collection
    
    # Resolve phone number if only email is provided
    if not phone and email:
        profile = user_profiles_collection.find_one({"email": email})
        if profile and profile.get("phone"):
            phone = profile["phone"]
            
    if not phone:
        # If still no phone, try fetching bookings by email directly (if associated)
        query = {"email": email} if email else {}
    else:
        query = {"phone": phone}

    bookings = list(booking_collection.find(query).sort("created_at", -1))
    
    for b in bookings:
        b["id"] = str(b["_id"])
        del b["_id"]
        
    return Response(bookings)

@api_view(['GET'])
def admin_bookings_api(request):
    bookings = list(
        booking_collection.find().sort("created_at", -1)
    )

    for b in bookings:
        b["id"] = str(b["_id"])
        del b["_id"]

    return Response(bookings)


def admin_bookings_page(request):
    """Admin: Manage visit bookings with status/date/agent/search filters. Defaults to pending."""

    # ── Filters from GET params ──────────────────────────
    status_filter = request.GET.get("status", "pending")   # default: pending
    search_query  = request.GET.get("q", "").strip()
    date_filter   = request.GET.get("date", "").strip()
    agent_filter  = request.GET.get("agent", "").strip()

    # ── Build MongoDB query ──────────────────────────────
    query = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    if search_query:
        query["$or"] = [
            {"name":  {"$regex": search_query, "$options": "i"}},
            {"phone": {"$regex": search_query, "$options": "i"}},
        ]

    if date_filter:
        query["date"] = date_filter

    if agent_filter:
        query["broker_name"] = {"$regex": agent_filter, "$options": "i"}

    # ── Pagination ───────────────────────────────────────
    try:
        page = int(request.GET.get("page", 1))
        if page < 1: page = 1
    except ValueError:
        page = 1
    page_size = 50

    total_items = booking_collection.count_documents(query)
    import math
    total_pages = math.ceil(total_items / page_size) if total_items > 0 else 1

    bookings = list(
        booking_collection.find(query)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )

    # ── Conflict detection ───────────────────────────────
    date_counts: dict = {}
    for b in bookings:
        d = b.get("date")
        if d and b.get("status") in ("pending", "approved"):
            date_counts[d] = date_counts.get(d, 0) + 1

    for b in bookings:
        b["id"]           = str(b["_id"])
        del b["_id"]
        d                 = b.get("date")
        b["has_conflict"] = date_counts.get(d, 0) > 1

    # ── Summary counts for tabs ──────────────────────────
    counts = {
        "all":       booking_collection.count_documents({}),
        "pending":   booking_collection.count_documents({"status": "pending"}),
        "approved":  booking_collection.count_documents({"status": "approved"}),
        "completed": booking_collection.count_documents({"status": "completed"}),
        "rejected":  booking_collection.count_documents({"status": {"$in": ["rejected", "cancelled"]}}),
    }

    # ── Active agents list for filter dropdown ───────────
    from listings.mongo import agents_collection
    agents = list(agents_collection.find({"is_active": {"$ne": False}}).sort("name", 1))
    for a in agents:
        a["id"] = str(a["_id"])

    tab_list = [
        ("pending",   "Pending",   "⏳"),
        ("approved",  "Approved",  "✅"),
        ("completed", "Completed", "🏁"),
        ("rejected",  "Rejected",  "❌"),
        ("all",       "All",       "📋"),
    ]

    return render(
        request,
        "admin_bookings.html",
        {
            "bookings":       bookings,
            "agents":         agents,
            "counts":         counts,
            "tab_list":       tab_list,
            "status_filter":  status_filter,
            "search_query":   search_query,
            "date_filter":    date_filter,
            "agent_filter":   agent_filter,
            "message":        request.GET.get("msg", ""),
            "error":          request.GET.get("err", ""),
            "current_page":   page,
            "total_pages":    total_pages,
            "has_next":       page < total_pages,
            "has_previous":   page > 1,
            "total_filtered": total_items,
        }
    )


@api_view(['POST'])
def update_booking_status_api(request, booking_id):
    status_value = request.data.get("status")
    broker_name = request.data.get("broker_name")

    if not status_value:
        return Response(
            {"error": "Status is required"},
            status=400
        )

    update_data = {"status": status_value}

    if broker_name:
        update_data["broker_name"] = broker_name

    result = booking_collection.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        return Response(
            {"error": "Booking not found"},
            status=404
        )

    return Response(
        {"message": "Booking updated successfully"},
        status=200
    )        

# --------------------------------------------------
# 🔹 GET: Site Detail by site_code (FIX)
# --------------------------------------------------
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


# ================================================================
# 🔷 ADMIN HUB VIEWS
# ================================================================

from listings.mongo import agents_collection, user_profiles_collection
from django.http import HttpResponseRedirect


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


def admin_agents_page(request):
    """Manage all agents — list and add new agents."""
    message = request.GET.get("msg", "")
    error = request.GET.get("err", "")

    agents = list(agents_collection.find().sort("name", 1))
    for a in agents:
        a["id"] = str(a["_id"])
        del a["_id"]

    return render(request, "admin_agents.html", {
        "agents": agents,
        "message": message,
        "error": error,
    })


def admin_add_agent(request):
    """POST: Create a new agent in the database."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/agents/")

    name = request.POST.get("name", "").strip()
    phone = request.POST.get("phone", "").strip()
    email = request.POST.get("email", "").strip()

    if not name or not phone:
        return HttpResponseRedirect("/admin/agents/?err=Name+and+phone+are+required")

    existing = agents_collection.find_one({"phone": phone})
    if existing:
        return HttpResponseRedirect(f"/admin/agents/?err=Agent+with+phone+{phone}+already+exists")

    agents_collection.insert_one({
        "name": name,
        "phone": phone,
        "email": email if email else None,
        "is_active": True,
        "created_at": datetime.now(),
    })
    return HttpResponseRedirect(f"/admin/agents/?msg=Agent+{name}+added+successfully")


def admin_toggle_agent(request):
    """POST: Toggle an agent's active status."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/agents/")

    agent_id = request.POST.get("agent_id")
    current_status = request.POST.get("current_status", "True")

    try:
        is_active = current_status.lower() not in ("false", "none")
        # Toggle
        agents_collection.update_one(
            {"_id": ObjectId(agent_id)},
            {"$set": {"is_active": not is_active}}
        )
        status_str = "deactivated" if is_active else "activated"
        return HttpResponseRedirect(f"/admin/agents/?msg=Agent+{status_str}+successfully")
    except Exception:
        return HttpResponseRedirect("/admin/agents/?err=Failed+to+update+agent+status")


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


SITE_FEATURES = [
    {"key": "corner_site", "label": "Corner Site"},
    {"key": "bbmp_approved", "label": "BBMP Approved"},
    {"key": "park_facing", "label": "Park Facing"},
    {"key": "road_facing", "label": "Road Facing"},
    {"key": "near_school", "label": "Near School"},
    {"key": "near_hospital", "label": "Near Hospital"},
    {"key": "gated_community", "label": "Gated Community"},
    {"key": "water_connection", "label": "Water Connection"},
    {"key": "electricity", "label": "Electricity"},
    {"key": "paved_road", "label": "Paved Road"},
    {"key": "east_west_road", "label": "E-W Road Access"},
    {"key": "loan_facility", "label": "Loan Facility"},
]


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


# ================================================================
# 🔶 AGENT PORTAL VIEWS
# ================================================================

def agent_portal_page(request):
    """SiteHub Agent Portal — login page."""
    # If already logged in, redirect to visits
    if request.session.get("agent_phone"):
        return HttpResponseRedirect("/agent/visits/")
    error = request.GET.get("err", "")
    return render(request, "agent_portal.html", {"error": error})


def agent_portal_login(request):
    """POST: Authenticate agent by phone number."""
    if request.method != "POST":
        return HttpResponseRedirect("/agent/portal/")

    phone = request.POST.get("phone", "").strip()
    agent = agents_collection.find_one({"phone": phone, "is_active": {"$ne": False}})

    if not agent:
        return HttpResponseRedirect("/agent/portal/?err=No+active+agent+found+with+this+phone")

    request.session["agent_phone"] = phone
    request.session["agent_name"] = agent.get("name", "Agent")
    return HttpResponseRedirect("/agent/visits/")


def agent_portal_logout(request):
    """Clear agent session and redirect to login."""
    request.session.flush()
    return HttpResponseRedirect("/agent/portal/")


def agent_visits_page(request):
    """Show visits assigned to the logged-in agent."""
    agent_phone = request.session.get("agent_phone")
    if not agent_phone:
        return HttpResponseRedirect("/agent/portal/")

    agent_name = request.session.get("agent_name", "Agent")
    agent = agents_collection.find_one({"phone": agent_phone})
    if not agent:
        return HttpResponseRedirect("/agent/portal/?err=Agent+not+found")

    # Match by agent name stored in booking
    visits = list(
        booking_collection.find({"broker_name": agent.get("name")}).sort("date", 1)
    )
    for v in visits:
        v["id"] = str(v["_id"])
        del v["_id"]

    return render(request, "agent_visits.html", {"visits": visits, "agent_name": agent_name})


def agent_complete_visit(request):
    """POST: Agent marks a visit as completed."""
    if request.method != "POST":
        return HttpResponseRedirect("/agent/visits/")
    if not request.session.get("agent_phone"):
        return HttpResponseRedirect("/agent/portal/")

    booking_id = request.POST.get("booking_id")
    try:
        booking_collection.update_one(
            {"_id": ObjectId(booking_id)},
            {"$set": {"status": "completed"}}
        )
    except Exception:
        pass
    return HttpResponseRedirect("/agent/visits/")


def agent_sites_page(request):
    """Show pending site listings for agent review."""
    if not request.session.get("agent_phone"):
        return HttpResponseRedirect("/agent/portal/")

    agent_name = request.session.get("agent_name", "Agent")
    sites = list(
        site_collection.find({"status": "pending", "is_deleted": {"$ne": True}}).sort("created_at", -1).limit(20)
    )
    for s in sites:
        s["id"] = str(s["_id"])
        del s["_id"]

    return render(request, "agent_sites.html", {"sites": sites, "agent_name": agent_name})


def agent_review_site(request):
    """POST: Agent recommends approval or rejection of a pending site."""
    if request.method != "POST":
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect("/agent/sites/")

    if not request.session.get("agent_phone"):
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect("/agent/portal/")

    site_code   = request.POST.get("site_code", "").strip()
    action      = request.POST.get("action", "").strip()   # "recommend_approve" | "recommend_reject"
    note        = request.POST.get("note", "").strip()
    agent_name  = request.session.get("agent_name", "Agent")

    if site_code and action in ("recommend_approve", "recommend_reject"):
        update_data = {
            "agent_review": action,
            "agent_review_note": note,
            "agent_reviewer": agent_name,
            "agent_reviewed_at": datetime.now(),
        }
        # If agent recommends approval, flag it for admin (status stays 'pending' until admin approves)
        if action == "recommend_approve":
            update_data["agent_flag"] = "recommended"
        else:
            update_data["agent_flag"] = "flagged_reject"

        site_collection.update_one(
            {"site_code": site_code},
            {"$set": update_data}
        )

    from django.http import HttpResponseRedirect
    return HttpResponseRedirect("/agent/sites/")




# ================================================================
# 🔷 ADMIN BOOKING UPDATE (Form-based — redirects back after save)
# ================================================================

def admin_update_booking(request, booking_id):
    """POST: Update booking. Blocks approval if agent already has a conflicting approved booking."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/bookings/")

    status_value = request.POST.get("status", "").strip()
    broker_name  = request.POST.get("broker_name", "").strip()
    date_value   = request.POST.get("date", "").strip()
    time_value   = request.POST.get("time", "").strip()

    # ── Agent conflict guard ─────────────────────────────────────────────────
    # If approving with an assigned agent, ensure that agent doesn't already
    # have another APPROVED booking on the same date within 1 hour.
    if status_value == "approved" and broker_name:
        existing = booking_collection.find_one({"_id": ObjectId(booking_id)})
        effective_date = date_value or (existing.get("date") if existing else "")
        effective_time = time_value or (existing.get("time") if existing else "")

        if effective_date:
            conflict_query = {
                "broker_name": broker_name,
                "status":      "approved",
                "date":        effective_date,
                "_id":         {"$ne": ObjectId(booking_id)},
            }
            conflicting = list(booking_collection.find(conflict_query))

            has_conflict = False
            if conflicting and effective_time:
                try:
                    from datetime import datetime as dt
                    req_t = dt.strptime(effective_time, "%H:%M")
                    for cb in conflicting:
                        cb_time_str = cb.get("time", "")
                        if cb_time_str:
                            diff_mins = abs((req_t - dt.strptime(cb_time_str, "%H:%M")).total_seconds()) / 60
                            if diff_mins < 60:
                                has_conflict = True
                                break
                        else:
                            has_conflict = True
                            break
                except ValueError:
                    has_conflict = bool(conflicting)
            elif conflicting:
                has_conflict = True

            if has_conflict:
                cb0 = conflicting[0]
                cb_time = cb0.get("time", "")
                err = (
                    f"Cannot approve: agent '{broker_name}' already has an approved visit on "
                    f"{effective_date}{' at ' + cb_time if cb_time else ''}. "
                    f"Assign a different agent or change the visit time."
                )
                import urllib.parse
                return HttpResponseRedirect(
                    f"/admin/bookings/?err={urllib.parse.quote(err)}&status=pending"
                )

    # ── Apply update ─────────────────────────────────────────────────────────
    update_data = {}
    if status_value:
        update_data["status"] = status_value
    if broker_name:
        update_data["broker_name"] = broker_name
    elif "broker_name" in request.POST:
        update_data["broker_name"] = ""
    if date_value:
        update_data["date"] = date_value
    if time_value:
        update_data["time"] = time_value

    try:
        booking_collection.update_one(
            {"_id": ObjectId(booking_id)},
            {"$set": update_data}
        )
    except Exception:
        pass

    return HttpResponseRedirect("/admin/bookings/?msg=Booking+updated+successfully")


@api_view(['POST'])
def admin_check_conflict_api(request):
    """POST endpoint to instantly check if an agent has a schedule conflict."""
    broker_name = request.data.get("broker_name", "").strip()
    date_val = request.data.get("date", "").strip()
    time_val = request.data.get("time", "").strip()
    booking_id = request.data.get("booking_id", "").strip()
    status_val = request.data.get("status", "pending").strip()

    # Only care if agent assigned and status is approved
    if not broker_name or status_val != "approved" or not date_val:
        return Response({"has_conflict": False})

    conflict_query = {
        "broker_name": broker_name,
        "status": "approved",
        "date": date_val,
    }
    if booking_id:
        try:
            conflict_query["_id"] = {"$ne": ObjectId(booking_id)}
        except Exception:
            pass

    conflicting = list(booking_collection.find(conflict_query))

    has_conflict = False
    if conflicting and time_val:
        try:
            from datetime import datetime as dt
            req_t = dt.strptime(time_val, "%H:%M")
            for cb in conflicting:
                cb_time_str = cb.get("time", "")
                if cb_time_str:
                    diff_mins = abs((req_t - dt.strptime(cb_time_str, "%H:%M")).total_seconds()) / 60
                    if diff_mins < 60:
                        has_conflict = True
                        break
                else:
                    has_conflict = True
                    break
        except ValueError:
            has_conflict = bool(conflicting)
    elif conflicting:
        has_conflict = True

    if has_conflict:
        cb0 = conflicting[0]
        cb_time = cb0.get("time", "")
        err_msg = (
            f"Agent '{broker_name}' is booked on "
            f"{date_val}{' at ' + cb_time if cb_time else ''}."
        )
        return Response({"has_conflict": True, "message": err_msg})

    return Response({"has_conflict": False})



# ================================================================
# 🔷 ADMIN SITE EDIT (Inline edit from pending sites page)
# ================================================================

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


# ================================================================
# 🔷 ADMIN USER PROFILE — JSON endpoint for the profile drawer
# ================================================================

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

