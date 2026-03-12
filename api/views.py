from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.views.decorators.csrf import csrf_exempt

from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime

from .serializers import SiteSerializer
from listings.mongo import site_collection, booking_collection
from listings.utils import generate_site_code

from django.core.files.storage import default_storage
from django.conf import settings
import os


# --------------------------------------------------
# 🔹 Helper: Normalize Image URL
# --------------------------------------------------
def normalize_image(request, image_path):
    if not image_path:
        return ""
    if image_path.startswith("http"):
        return image_path
    return f"{request.scheme}://{request.get_host()}{settings.MEDIA_URL}{image_path}"


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
# 🔹 GET: Filter Sites + Sort
# --------------------------------------------------
@api_view(['GET'])
def filter_sites_api(request):
    query = {"status": "approved", "is_deleted": {"$ne": True}}

    location = request.GET.get("location")
    search = request.GET.get("search")  # General search term
    min_price = request.GET.get("min_price")
    max_price = request.GET.get("max_price")
    site_code = request.GET.get("site_code")
    sort = request.GET.get("sort")

    if location:
        query["location"] = {"$regex": location, "$options": "i"}

    if site_code:
         query["site_code"] = {"$regex": site_code, "$options": "i"}

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"location": {"$regex": search, "$options": "i"}},
            {"landmark": {"$regex": search, "$options": "i"}},
            {"site_code": {"$regex": search, "$options": "i"}},
        ]

    if min_price or max_price:
        query["price"] = {}
        if min_price:
            query["price"]["$gte"] = int(min_price)
        if max_price:
            query["price"]["$lte"] = int(max_price)

    cursor = site_collection.find(query)

    if sort == "price_low":
        cursor = cursor.sort("price", 1)
    elif sort == "price_high":
        cursor = cursor.sort("price", -1)

    # ---------------- PAGINATION ----------------
    page = int(request.GET.get("page", 1))
    limit = int(request.GET.get("limit", 12))
    skip = (page - 1) * limit

    total = site_collection.count_documents(query)
    cursor = cursor.skip(skip).limit(limit)

    sites = list(cursor)

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
        
    cursor = site_collection.find(query).sort("created_at", -1)
    sites = list(cursor)

    sites = list(cursor)
    sites = hydrate_sites(request, sites)

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
            "user_id": user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "is_deleted": False,
            
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

    if result.deleted_count == 0:
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

    return Response(
        {"message": "Visiting request submitted"},
        status=201
    )

@api_view(['GET'])
def my_bookings_api(request):
    phone = request.GET.get("phone")
    email = request.GET.get("email")
    
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
    search_phone = request.GET.get("phone", "")
    
    query = {}
    if search_phone:
        query["phone"] = search_phone
        
    bookings = list(
        booking_collection.find(query).sort("date", 1)  # Sort by date for better conflict visualization
    )
    
    # Needs to be sorted by created_at ideally, but let's let python sort or maintain sort
    bookings.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)

    from listings.mongo import agents_collection
    agents = list(agents_collection.find({"is_active": {"$ne": False}}))
    for a in agents:
        a["id"] = str(a["_id"])

    # Basic Conflict Detection (same date)
    date_counts = {}
    for b in bookings:
        d = b.get("date")
        if d and b.get("status") in ("pending", "approved"):
            date_counts[d] = date_counts.get(d, 0) + 1
            
    for b in bookings:
        b["id"] = str(b["_id"])
        del b["_id"]
        # Mark conflict if multiple active bookings exist on that day
        d = b.get("date")
        b["has_conflict"] = date_counts.get(d, 0) > 1

    return render(
        request,
        "admin_bookings.html",
        {
            "bookings": bookings,
            "search_phone": search_phone,
            "agents": agents,
            "message": request.GET.get("msg", ""),
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
    """Show all sites with pending status for admin review."""
    message = request.GET.get("msg", "")
    sites_cursor = site_collection.find({"status": "pending", "is_deleted": {"$ne": True}}).sort("created_at", -1)
    sites = []
    for s in sites_cursor:
        s["id"] = str(s["_id"])
        del s["_id"]
        sites.append(s)
    return render(request, "admin_sites_pending.html", {"sites": sites, "message": message})


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
        dimension = request.POST.get("dimension", "")
        facing = request.POST.get("facing", "")
        description = request.POST.get("description", "")
        owner = request.POST.get("owner", "").strip()
        uploaded_phone = request.POST.get("uploaded_phone", "").strip()
        site_status = request.POST.get("status", "pending")

        if not name or not location or not price or not owner or not uploaded_phone:
            return HttpResponseRedirect("/admin/sites/upload/?err=Please+fill+all+required+fields")

        from listings.utils import generate_site_code
        site_code = generate_site_code(name)

        features = {f["key"]: (request.POST.get(f["key"]) == "true") for f in SITE_FEATURES}

        site_doc = {
            "site_code": site_code,
            "name": name,
            "location": location,
            "price": float(price),
            "area": float(area) if area else None,
            "dimension": dimension,
            "facing": facing,
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


# ================================================================
# 🔷 ADMIN BOOKING UPDATE (Form-based — redirects back after save)
# ================================================================

def admin_update_booking(request, booking_id):
    """POST: Update booking status, agent, date, and time. Redirects back to /admin/bookings/."""
    if request.method != "POST":
        return HttpResponseRedirect("/admin/bookings/")

    status_value = request.POST.get("status", "").strip()
    broker_name  = request.POST.get("broker_name", "").strip()
    date_value   = request.POST.get("date", "").strip()
    time_value   = request.POST.get("time", "").strip()

    update_data = {}
    if status_value:
        update_data["status"] = status_value
    if broker_name:
        update_data["broker_name"] = broker_name
    elif "broker_name" in request.POST:
        # Explicit empty = clear assignment
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
    }
    if price:
        update_data["price"] = float(price)
    if area:
        update_data["area"] = float(area)
    if action == "save_approve":
        update_data["status"] = "approved"

    site_collection.update_one(
        {"site_code": site_code},
        {"$set": update_data}
    )

    if action == "save_approve":
        return HttpResponseRedirect(f"/admin/sites/pending/?msg=Site+{site_code}+saved+and+approved")
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

