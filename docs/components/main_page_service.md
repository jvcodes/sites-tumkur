# Component: Main Page Service

The Main Page Service is the core landing experience for end-users seeking properties.

## Frontend Layout (`frontend/app/page.tsx`)
The homepage renders a highly dynamic user interface:
- **Hero Tracker:** Allows users to punch in a `site_code` to directly resolve a detailed property view.
- **Search & Filters:** A sidebar dedicated to advanced querying (Price sliders, String Location parsing, Global text inputs, Sorting).
- **Site Feed:** A responsive grid map iterating over JSON provided by the backend.

## Backend Hook (`filter_sites_api`)
Located in `api/views.py`, this API accepts multiple query parameters.
1. It builds a MongoDB query dictionary based on inputs (e.g., Min/Max pricing thresholds, RegEx string parsing for Search/Location).
2. It enforces `{ status: "approved", is_deleted: { $ne: True } }` meaning the public feed only displays safe, validated listings.
3. Pagination handles massive data offsets via `skip()` and `limit()`.
4. It calls `hydrate_sites` to grab Image URLs and Location strings from separate collections, then serializes the data to JSON for the NextJS UI.
