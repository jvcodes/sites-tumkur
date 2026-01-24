from django.shortcuts import render, redirect
from django.http import HttpResponse
from django.core.files.storage import FileSystemStorage
from bson import ObjectId
from .forms import SiteForm
from .mongo import site_collection
from django.http import JsonResponse
from django.http import Http404
from .mongo import site_collection, chat_collection
import re
from django.views.decorators.csrf import csrf_exempt
# mongo.py
from pymongo import MongoClient
from listings.utils import generate_site_code


client = MongoClient("mongodb://localhost:27017/")
db = client["site_db"]   # use your actual DB name





def upload_site(request, site_id=None):
    site_data = None

    # ---------------- FETCH EXISTING SITE (EDIT) ----------------
    if site_id:
        site_data = site_collection.find_one({'_id': ObjectId(site_id)})

    if request.method == 'POST':
        form = SiteForm(request.POST, request.FILES)

        if form.is_valid():
            data = {}

            # ---------------- SAVE NORMAL FIELDS ----------------
            for key, value in form.cleaned_data.items():
                if key != 'image' and value not in [None, '', []]:
                    data[key] = value

            # ---------------- MAP PIN LOCATION ----------------
            lat = request.POST.get("latitude")
            lng = request.POST.get("longitude")

            if lat and lng:
                try:
                    data["latitude"] = float(lat)
                    data["longitude"] = float(lng)
                except ValueError:
                    pass  # Ignore invalid coordinates safely

            # ---------------- IMAGE HANDLING ----------------
            image = request.FILES.get('image')
            fs = FileSystemStorage()

            if image:
                filename = fs.save(image.name, image)
                data['image'] = fs.url(filename)
            elif site_data and 'image' in site_data:
                # Keep old image during update
                data['image'] = site_data['image']

            # ---------------- STATUS RESET ----------------
            data['status'] = 'pending'

            # ---------------- UPDATE EXISTING SITE ----------------
            if site_id:
                site_collection.update_one(
                    {'_id': ObjectId(site_id)},
                    {'$set': data}
                )

                return HttpResponse(
                    "<h2>Your site has been updated successfully and sent for admin approval.</h2>"
                )

            # ---------------- INSERT NEW SITE ----------------
            else:
                data['site_code'] = generate_site_code()  # ✅ ONLY FOR NEW SITE

                site_collection.insert_one(data)

                return HttpResponse(
                    "<h2>Your site has been uploaded successfully and sent for admin approval.</h2>"
                )

    else:
        form = SiteForm(initial=site_data if site_data else None)

    return render(request, 'upload_site.html', {
        'form': form,
        'is_edit': bool(site_id)
    })





def site_list(request):
    filters = {"status": "approved"}

    # -------- TEXT FILTERS --------
    location = request.GET.get("location")
    landmark = request.GET.get("landmark")

    if location:
        filters["location"] = {"$regex": location.strip(), "$options": "i"}

    if landmark:
        filters["landmark"] = {"$regex": landmark.strip(), "$options": "i"}

    # -------- PRICE FILTER --------
    min_price = request.GET.get("min_price")
    max_price = request.GET.get("max_price")

    if min_price or max_price:
        filters["price"] = {}
        if min_price:
            filters["price"]["$gte"] = int(min_price)
        if max_price:
            filters["price"]["$lte"] = int(max_price)

    # -------- AREA FILTER --------
    min_area = request.GET.get("min_area")
    max_area = request.GET.get("max_area")

    if min_area or max_area:
        filters["area"] = {}
        if min_area:
            filters["area"]["$gte"] = int(min_area)
        if max_area:
            filters["area"]["$lte"] = int(max_area)

    # -------- DROPDOWN FILTERS --------
    facing = request.GET.get("facing")
    ownership_type = request.GET.get("ownership_type")
    availability = request.GET.get("availability")
    zoning_type = request.GET.get("zoning_type")

    if facing:
        filters["facing"] = facing

    if ownership_type:
        filters["ownership_type"] = ownership_type

    if availability:
        filters["availability"] = availability

    if zoning_type:
        filters["zoning_type"] = zoning_type

    # -------- EXTRA NUMERIC FILTERS --------
    road_width = request.GET.get("road_width")
    distance = request.GET.get("distance_to_main_road")

    if road_width:
        filters["road_width"] = {"$gte": int(road_width)}

    if distance:
        filters["distance_to_main_road"] = {"$lte": int(distance)}

    # -------- SORTING --------
    sort_price = request.GET.get("sort_price")

    if sort_price == "low_high":
        sites_cursor = site_collection.find(filters).sort("price", 1)
    elif sort_price == "high_low":
        sites_cursor = site_collection.find(filters).sort("price", -1)
    else:
        sites_cursor = site_collection.find(filters)

    # -------- BUILD LIST --------
    site_list = []
    for s in sites_cursor:
        s["id_str"] = str(s["_id"])
        site_list.append(s)

    # -------- CONTEXT --------
    context = {
        "sites": site_list,
        "facing_choices": ["east", "west", "north", "south"],
        "ownership_choices": ["individual", "developer", "broker"],
        "availability_choices": ["available", "sold"],
        "zoning_choices": ["residential", "commercial", "agricultural"],
    }

    return render(request, "site_list.html", context)






def admin_dashboard(request):
    # Count sites by status
    pending = site_collection.count_documents({'status': 'pending'})
    approved = site_collection.count_documents({'status': 'approved'})
    rejected = site_collection.count_documents({'status': 'rejected'})

    # Fetch pending sites
    sites_cursor = site_collection.find({'status': 'pending'})
    sites = []

    for site in sites_cursor:
        site['id_str'] = str(site['_id'])
        sites.append(site)

    return render(request, 'admin_dashboard.html', {
        'sites': sites,
        'pending': pending,
        'approved': approved,
        'rejected': rejected
    })




def approve_site(request, site_id):
    site_collection.update_one(
        {'_id': ObjectId(site_id)},
        {'$set': {'status': 'approved'}}
    )
    return redirect('admin_dashboard')


def reject_site(request, site_id):
    site_collection.update_one(
        {'_id': ObjectId(site_id)},
        {'$set': {'status': 'rejected'}}
    )
    return redirect('admin_dashboard')

def rejected_sites(request):
    sites_cursor = site_collection.find({'status': 'rejected'})
    sites = []

    for site in sites_cursor:
        print(site)  # 👈 DEBUG
        site['id_str'] = str(site['_id'])
        sites.append(site)

    print("TOTAL REJECTED:", len(sites))
    return render(request, 'rejected_sites.html', {'sites': sites})

def view_on_map(request, site_id):
    site = site_collection.find_one({"_id": ObjectId(site_id)})

    if not site:
        return HttpResponse("Site not found")

    site["id_str"] = str(site["_id"])

    return render(request, "map_view.html", {"site": site})

def site_detail(request, site_id):
    site = db.sites.find_one(
        {"_id": ObjectId(site_id)}
    )  # ✅ NO PROJECTION

    return render(request, "site_detail.html", {
        "site": site
    })






@csrf_exempt
def chat(request):
    user_msg = request.POST.get("message", "").lower()

    location = None
    min_price = None
    max_price = None

    # 🔹 Extract location
    locations = ["tumkur", "bangalore", "mysore"]
    for loc in locations:
        if loc in user_msg:
            location = loc

    # 🔹 Extract price
    prices = re.findall(r'\d+', user_msg)
    if prices:
        min_price = int(prices[0])

    # 🔹 MongoDB query
    query = {"status": "approved"}

    if location:
        query["location"] = location

    if min_price:
        query["price"] = {"$lte": min_price}

    sites = list(db.sites.find(query))

    if not sites:
        return JsonResponse({
            "reply": "No sites found matching your criteria."
        })

    reply = "Here are some sites:\n"
    for s in sites[:3]:
        reply += f"{s['name']} - ₹{s['price']} - {s['location']}\n"

    return JsonResponse({"reply": reply})


def edit_site(request, site_id):
    site = db.sites.find_one({"_id": ObjectId(site_id)})

    if not site:
        return HttpResponse("Site not found")

    if request.method == "POST":
        updated_data = {
            "name": request.POST.get("name"),
            "location": request.POST.get("location").lower(),
            "area": float(request.POST.get("area")),
            "price": float(request.POST.get("price")),
            "owner": request.POST.get("owner"),
        }

        # 🔁 If site was already approved, send back for re-approval
        if site.get("status") == "approved":
            updated_data["status"] = "pending"

        db.sites.update_one(
            {"_id": ObjectId(site_id)},
            {"$set": updated_data}
        )

        return redirect("admin_dashboard")

    return render(
        request,
        "edit_site.html",
        {"site": site}
    )


def approved_sites_admin(request):
    sites = list(db.sites.find({"status": "approved"}))

    for site in sites:
        site["id_str"] = str(site["_id"])  # ✅ FIX

    return render(request, "approved_sites_admin.html", {
        "sites": sites
    })









