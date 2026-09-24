from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
from listings.mongo import booking_collection, agents_collection, user_profiles_collection
from api.views.utils import normalize_image, hydrate_sites

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

