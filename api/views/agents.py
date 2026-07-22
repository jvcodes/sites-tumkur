from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from datetime import datetime
from listings.mongo import agents_collection
from api.views.utils import normalize_image, hydrate_sites

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

