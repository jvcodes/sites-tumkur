# Database Schema (MongoDB)

Our platform utilizes MongoDB natively without Django ORM, offering highly flexible document storage. The definitions and index configurations are primarily stored in `listings/mongo.py`.

## Core Collections

### 1. `sites`
Stores the property/site listings available for booking.
- `site_code`: Unique identifier (String)
- `name`: Property Title
- `location_id`: Reference to locations collection
- `price`, `area`, `dimension`, `facing`: Attributes
- `status`: Property status (e.g., `approved`, `pending`)
- `owner`: Owner details
- `user_id`: Original creator
- *Various Boolean Specs* (`corner_site`, `bbmp_approved`, etc.)

### 2. `bookings`
Stores the user scheduling requests for property visits.
- `name`, `phone`, `email`: User details. **Phone** acts as the primary global identifier to prevent duplicates.
- `date`, `time`: Execution schedules.
- `sites`: An array snapshot of the cart at checkout time.
- `status`: Lifecycle (`pending`, `approved`, `completed`, `rejected`)
- `broker_name`: The ID/Name of the Assigned Agent.

### 3. `user_profiles`
Maintains a normalized mapping of users to reduce duplication.
- `email`: Authenticated Email (if they logged in).
- `phone`: Primary Identifier (ensures even unauthenticated users scale into a single profile).
- `name`: Display Name.

### 4. `agents`
Manages the internal workforce available for assignment.
- `name`, `phone`
- `is_active`: Boolean allowing agents to be turned off if unavailable.

### 5. `site_images` & `locations`
- **Locations**: Unique city/area pairings assigned an `_id` and heavily indexed for search efficiency.
- **Images**: Bound via `site_code` tracking URL paths. Keeps the `sites` collection small by abstracting heavy media arrays out.

## Scaling & Indexing Strategy
To optimize for scale, heavy compound text indexes and standard unique indexes are applied upon backend boot (`setup_database_indexes`):
- Unique constraints applied to `site_code`, `email`, and `Locations (city/area)`.
- Compound indexes applied to tracking user uploaded sites: `[user_id, dimension, location_id]` to prevent spam overlaps.
- Lookups dynamically "hydrate" queries (see `hydrate_sites` in views) by merging Site JSON with Location and Image dictionaries natively in Python to emulate SQL JOINs efficiently without complex aggregation pipelines.
