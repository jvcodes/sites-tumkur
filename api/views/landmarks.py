from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from bson import ObjectId
from listings.mongo import landmarks_collection

# --------------------------------------------------
# 🔹 Default Tumkur Landmarks
# --------------------------------------------------
DEFAULT_TUMKUR_LANDMARKS = [
    {"name": "Tumkur Railway Station", "category": "Transport"},
    {"name": "Tumkur KSRTC Bus Stand", "category": "Transport"},
    {"name": "Siddaganga Mutt / Kyatsandra", "category": "Heritage"},
    {"name": "SIT College (Siddaganga Institute of Technology)", "category": "Education"},
    {"name": "Tumkur University", "category": "Education"},
    {"name": "District Hospital Tumkur", "category": "Healthcare"},
    {"name": "Gubbi Gate", "category": "Commercial"},
    {"name": "NH-48 Highway (Bangalore-Pune)", "category": "Connectivity"},
    {"name": "Amanikere Lake & Park", "category": "Recreation"},
    {"name": "Vasanthanarasapura Industrial Area", "category": "Industrial"},
    {"name": "Tumkur DC Office / Mini Vidhana Soudha", "category": "Government"},
]

def ensure_default_landmarks():
    """Ensure default Tumkur landmarks exist in the database."""
    if landmarks_collection.count_documents({}) == 0:
        for lm in DEFAULT_TUMKUR_LANDMARKS:
            landmarks_collection.update_one(
                {"name": lm["name"]},
                {"$set": {"name": lm["name"], "category": lm.get("category", "General"), "is_active": True}},
                upsert=True
            )

# --------------------------------------------------
# 🔹 Public API: Get Active Landmarks
# --------------------------------------------------
@api_view(['GET'])
def get_landmarks_api(request):
    """Returns a sorted list of landmarks available in Tumkur."""
    ensure_default_landmarks()
    cursor = landmarks_collection.find({"is_active": {"$ne": False}})
    landmarks = []
    for doc in cursor:
        landmarks.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "category": doc.get("category", "General")
        })
    landmarks.sort(key=lambda x: x["name"])
    return Response({"landmarks": landmarks})

# --------------------------------------------------
# 🔹 Admin Hub: Landmarks Management Page
# --------------------------------------------------
def admin_landmarks_page(request):
    """Renders the admin management interface for Tumkur landmarks."""
    ensure_default_landmarks()
    message = request.GET.get("msg", "")
    cursor = landmarks_collection.find({"is_active": {"$ne": False}})
    landmarks = []
    for doc in cursor:
        landmarks.append({
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "category": doc.get("category", "General")
        })
    landmarks.sort(key=lambda x: x["name"])
    return render(request, "admin_landmarks.html", {
        "landmarks": landmarks,
        "message": message,
        "total_landmarks": len(landmarks)
    })

# --------------------------------------------------
# 🔹 Admin Action: Add Landmark
# --------------------------------------------------
@csrf_exempt
def admin_add_landmark(request):
    """Admin endpoint to create a new landmark."""
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        category = request.POST.get("category", "General").strip()
        if name:
            landmarks_collection.update_one(
                {"name": name},
                {"$set": {"name": name, "category": category, "is_active": True}},
                upsert=True
            )
            return redirect("/admin/landmarks/?msg=Landmark+added+successfully")
    return redirect("/admin/landmarks/")

# --------------------------------------------------
# 🔹 Admin Action: Delete Landmark
# --------------------------------------------------
@csrf_exempt
def admin_delete_landmark(request):
    """Admin endpoint to delete or deactivate a landmark."""
    if request.method == "POST":
        landmark_id = request.POST.get("landmark_id", "")
        name = request.POST.get("name", "")
        if landmark_id:
            try:
                landmarks_collection.delete_one({"_id": ObjectId(landmark_id)})
            except Exception:
                pass
        elif name:
            landmarks_collection.delete_one({"name": name})
        return redirect("/admin/landmarks/?msg=Landmark+removed+successfully")
    return redirect("/admin/landmarks/")
