# Authentication & Access Control

This document covers all the ways users, admins, and agents authenticate into the SiteHub platform. There are **three distinct authentication layers** — one for end-users, one for admins, and one for agents.

---

## 1. End-User Authentication (Frontend)

Regular site visitors log in via **Google Sign-In**, simulated through the Django backend's token auth system.

### How It Works
1. The **Next.js frontend** triggers a Google OAuth popup (managed via Firebase or a mock auth flow).
2. The user's Google `email` and `name` are sent to the backend via `POST /api/auth/google/`.
3. The Django backend:
   - Creates a new `User` record (SQLite) if the email doesn't exist.
   - Generates a **DRF Token** (`rest_framework.authtoken`) tied to that user.
   - Creates or updates a matching `user_profiles` document in MongoDB.
4. The token is returned to the frontend and stored locally (`localStorage` or context).

### Key Points
- Email is the **primary identifier** for front-end users in Django's auth system.
- Phone number is the **primary identifier** in MongoDB's `user_profiles` and `bookings` collections.
- When a user makes a booking, their phone is stored so history can be searched without being logged in.

### Files Involved
- `api/auth_views.py` — `google_auth_api` endpoint
- `frontend/app/context/AuthContext.tsx` — stores token and user state
- MongoDB: `user_profiles` collection

---

## 2. Admin Dashboard Authentication

The Admin Hub is accessible at the Django backend URL (not React) and is protected by **Django's built-in session login** (superuser).

| URL | Access |
|---|---|
| `http://localhost:8000/api/admin/hub/` | Admin Hub Dashboard |
| `http://localhost:8000/api/admin/agents/` | Manage Agents |
| `http://localhost:8000/api/admin/sites/pending/` | Approve/Reject Sites |
| `http://localhost:8000/api/admin/sites/upload/` | Upload a Site Listing |
| `http://localhost:8000/api/admin/bookings/` | Visit Approvals |

### Default Credentials
- **Username:** `admin`
- **Password:** `admin123`
- To reset: `python debug/create_superuser.py`

> [!NOTE]
> Admin pages are served directly by Django templates, not the Next.js app. Regular frontend users will never see or navigate to these URLs.

---

## 3. SiteHub Agent Portal (Phone-Based Session)

Agents have their own separate portal with **session-based login by phone number**.

| URL | Action |
|---|---|
| `http://localhost:8000/api/agent/portal/` | Login with registered phone |
| `http://localhost:8000/api/agent/visits/` | View assigned visits, mark as completed |
| `http://localhost:8000/api/agent/sites/` | Browse pending site listings |

### How It Works
1. Agent enters their registered phone number at `/api/agent/portal/`.
2. Backend checks `agents_collection` in MongoDB for a matching active agent.
3. On success, the agent's `phone` and `name` are stored in a **Django session**.
4. All subsequent agent pages read from the session — no JWT or API token is used.
5. Agent logs out via `/api/agent/portal/logout/` which flushes the session.

> [!IMPORTANT]
> Agents must be first **added by an admin** via `/api/admin/agents/` before they can log in. Their phone number is the primary key — no two agents can share the same phone.

---

## Summary Table

| User Type | Auth Method | Primary Identifier | Session Storage |
|---|---|---|---|
| End-User (Frontend) | Google OAuth → DRF Token | Email (Django) / Phone (MongoDB) | `localStorage` (frontend) |
| Admin | Django Superuser (username/password) | Username | Django Session |
| Agent | Phone number lookup (MongoDB) | Phone | Django Session |
