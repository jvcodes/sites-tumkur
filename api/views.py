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
    sites = data.get("sites")

    if not name or not phone or not date or not sites:
        return Response(
            {"error": "Missing booking details"},
            status=400
        )

    booking = {
        "name": name,
        "phone": phone,
        "date": date,
        "sites": sites,
        "status": "pending",
        "created_at": datetime.now()
    }

    booking_collection.insert_one(booking)

    return Response(
        {"message": "Booking request submitted"},
        status=201
    )


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
    bookings = list(
        booking_collection.find().sort("created_at", -1)
    )

    for b in bookings:
        b["id"] = str(b["_id"])
        del b["_id"]

    return render(
        request,
        "admin_bookings.html",
        {"bookings": bookings}
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
