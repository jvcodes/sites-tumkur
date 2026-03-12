# Admin Hub & Agent Portal

This document covers the admin control center and the agent-facing portal built on the Django template backend.

> [!NOTE]
> All admin and agent URLs are served directly by Django (port 8000) — they are NOT part of the Next.js frontend. Regular site users never interact with these pages.

---

## Admin Hub (Superuser Only)

### Quick Access Links

| Page | URL | Purpose |
|---|---|---|
| Dashboard | `http://localhost:8000/admin/hub/` | Live stats — Pending Visits, Pending Sites, Active Agents, Total Bookings |
| Manage Agents | `http://localhost:8000/admin/agents/` | Add, activate, or deactivate field agents |
| Visit Approvals | `http://localhost:8000/admin/bookings/` | Approve visits, assign agents, detect scheduling conflicts |
| Pending Sites | `http://localhost:8000/admin/sites/pending/` | Approve or reject user-uploaded site listings |
| Upload Site | `http://localhost:8000/admin/sites/upload/` | Create a site on behalf of any user by phone number |

### Login Credentials
| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |
| Reset command | `python debug/create_superuser.py` |

### Adding Agents
1. Go to `http://localhost:8000/admin/agents/`
2. Fill in the **Add New Agent** form — Name, Phone (primary ID), optional Email.
3. Click **Add Agent**.
4. The agent now appears in the Visit Approvals dropdown and can log in to the Agent Portal.

### Approving a Visit
1. Go to `http://localhost:8000/admin/bookings/`
2. Find the booking card showing Name, Phone, Requested Date, Requested Time, and Sites to Visit.
3. Select an Agent from the dropdown.
4. Change Status `Pending` → `Approved`.
5. Click **Update**.

### Scheduling Conflict Detection
If multiple bookings exist on the **same date**, the dashboard shows a red **⚠️ Conflict Detected** banner on affected booking cards, so you can coordinate rescheduling.

---

## SiteHub Agent Portal

A separate lightweight portal exclusively for field agents.

### Agent Login
Agents log in at `http://localhost:8000/agent/portal/` using their **registered phone number only** — no password required. The backend looks up the phone against the `agents_collection` in MongoDB.

### Agent Dashboard Pages

| Page | URL | Description |
|---|---|---|
| Login | `http://localhost:8000/agent/portal/` | Phone-based login screen |
| My Assigned Visits | `http://localhost:8000/agent/visits/` | Shows only visits where `broker_name` matches the logged-in agent |
| Site Reviews | `http://localhost:8000/agent/sites/` | Browse pending site submissions |
| Mark Visit Complete | POST to `/agent/visits/complete/` | Agent marks a visit as completed |
| Logout | `http://localhost:8000/agent/portal/logout/` | Clears the agent session |

> [!NOTE]
> Final approval/rejection of sites remains with the Admin. Agents can only view pending sites for awareness from the portal.

---

## URL Routing Notes

> [!IMPORTANT]
> Django's built-in default admin was moved from `/admin/` to `/django-admin/` to avoid route conflicts with the custom Admin Hub. If you need to manage Django users or auth tokens directly, use `http://localhost:8000/django-admin/`.

All admin and agent routes are registered in **two places** so they work both with and without the `/api/` prefix:
- `sitehub/urls.py` — short-form routes (e.g. `/admin/hub/`)
- `api/urls.py` — full-form routes (e.g. `/api/admin/hub/`)

---

## Navigation Flow

```
Admin → http://localhost:8000/admin/hub/
    ├── Manages Agents       → /admin/agents/
    ├── Approves Visits      → /admin/bookings/
    ├── Approves Sites       → /admin/sites/pending/
    └── Uploads Sites        → /admin/sites/upload/

Agent → http://localhost:8000/agent/portal/
    ├── My Assigned Visits   → /agent/visits/
    └── Site Reviews         → /agent/sites/

Regular Users → http://localhost:3000   (Next.js frontend)
```

