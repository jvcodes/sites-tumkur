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
    return f"{request.scheme}://{request.get_host()}{settings.MEDIA_URL}{image_path}"


# --------------------------------------------------
# 🔹 GET: Approved Sites
# --------------------------------------------------
@api_view(['GET'])
def approved_sites_api(request):
    page = int(request.GET.get("page", 1))
    limit = int(request.GET.get("limit", 9))
    skip = (page - 1) * limit

    total = site_collection.count_documents(
        {"status": "approved"}
    )

    cursor = (
        site_collection
        .find({"status": "approved"})
        .skip(skip)
        .limit(limit)
    )

    sites = list(cursor)

    for s in sites:
        s["id"] = str(s["_id"])
        s["site_code"] = s.get("site_code", "")
        s["area"] = s.get("area", 0)
        s["owner"] = s.get("owner", "")

        # ✅ FIX: normalize image
        if s.get("image"):
            s["image"] = normalize_image(request, s["image"])
        else:
            s["image"] = ""

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
    query = {"status": "approved"}

    location = request.GET.get("location")
    min_price = request.GET.get("min_price")
    max_price = request.GET.get("max_price")
    site_code = request.GET.get("site_code")
    sort = request.GET.get("sort")

    if location:
        query["location"] = {"$regex": location, "$options": "i"}

    if site_code:
        query["site_code"] = {"$regex": site_code, "$options": "i"}

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

    sites = list(cursor)

    for s in sites:
        s["id"] = str(s["_id"])
        s["site_code"] = s.get("site_code", "")
        s["area"] = s.get("area", 0)
        s["owner"] = s.get("owner", "")

        # ✅ FULL IMAGE URL
        if s.get("image"):
            s["image"] = normalize_image(request, s["image"])
        else:
            s["image"] = ""

    serializer = SiteSerializer(sites, many=True)
    return Response(serializer.data)


# --------------------------------------------------
# 🔹 POST: Create Site (Image Upload FIXED)
# --------------------------------------------------
@csrf_exempt
@api_view(['POST'])
def create_site_api(request):
    try:
        name = request.POST.get("name")
        location = request.POST.get("location")
        price = request.POST.get("price")
        area = request.POST.get("area")
        owner = request.POST.get("owner")
        image = request.FILES.get("image")

        if not name or not location or not price:
            return Response(
                {"error": "Missing required fields"},
                status=status.HTTP_400_BAD_REQUEST
            )

        site_data = {
            "site_code": generate_site_code(),
            "name": name,
            "location": location,
            "price": int(price),
            "status": "pending"
        }

        if area:
            site_data["area"] = int(area)

        if owner:
            site_data["owner"] = owner

        # ✅ SAVE IMAGE PROPERLY
        if image:
            image_path = default_storage.save(
                f"sites/{image.name}", image
            )
            site_data["image"] = image_path

        site_collection.insert_one(site_data)

        return Response(
            {"message": "Site submitted for approval"},
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
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
        "name", "location", "area",
        "price", "owner", "status"
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
    site["id"] = str(site["_id"])

    if site.get("image"):
        site["image"] = normalize_image(request, site["image"])

    serializer = SiteSerializer(site)
    return Response(serializer.data)


# --------------------------------------------------
# 🔹 DELETE: Site
# --------------------------------------------------
@api_view(['DELETE'])
def delete_site_by_code_api(request, site_code):
    result = site_collection.delete_one({"site_code": site_code})

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
        "status": "approved"
    })

    if not site:
        return Response(
            {"error": "Site not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    site["id"] = str(site["_id"])
    site["site_code"] = site.get("site_code", "")
    site["area"] = site.get("area", 0)
    site["owner"] = site.get("owner", "")

    # ✅ normalize image
    if site.get("image"):
        site["image"] = normalize_image(request, site["image"])
    else:
        site["image"] = ""

    serializer = SiteSerializer(site)
    return Response(serializer.data)
