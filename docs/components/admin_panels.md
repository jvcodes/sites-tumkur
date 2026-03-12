# Component: Custom Admin Panels

> See [admin_agent_portal.md](./admin_agent_portal.md) for full details on the Admin Hub, Agent Portal, default credentials, and navigation flow.

To secure site management, custom administrative interfaces were written separating logic away from Django's default Admin dashboard.

## Booking Administration (`/admin/bookings/`)
Located natively via Python templating at `listings/templates/admin_bookings.html`.

### Default Credentials
To access the dashboard and perform actions, use the Superuser account:
- **Username**: `admin`
- **Password**: `admin123`
*(Note: If you need to reset this password or create a new superuser, run the script `python debug/create_superuser.py`)*

### The Controller (`admin_bookings_page` inside `api/views.py`)
- **Security:** Access routed directly using Django's HTTP responses (typically requires custom middleware for authentication, currently leverages default).
- **Data Gathering:** Iterates `booking_collection` and `agents_collection` dynamically.
- **Conflict Tracking:**
  - `date_counts` dictionary checks for multiple bookings on equal dates holding `pending` or `approved` statuses.
  - Attaches `has_conflict = True` locally per iteration before sending to HTML mapping.

### The UI
- **Tailwind Grid:** Designed natively spanning cards per row on larger monitors.
- **Searching:** Form uses GET parameters (`?phone=`) to parse identical history logs securely.
- **Warnings:** Deeply stylized bold-red header injected ONLY when `booking.has_conflict` flags true in Django.
- **Agent Selection:** Securely populates a `<select>` dropdown using mapped Active agents, sending POST payload logic securely to `/api/bookings/update/{{ booking.id }}/` along with Approval/Rejection status.
