# Approval Logic Workflow

The complete lifecycle for organizing site visits and scheduling properties involves the following steps:

## 1. Checkout (Add to Cart)
End-users explore NextJS fetching sites and saving objects locally using `localStorage`.

## 2. Submission (Submit Visiting)
Triggered within `/cart`. 
- Gathers `name`, `phone`, `date`, `time`, and the cart payload.
- Hits `/api/bookings/create/` which executes:
  - Database Insertion: `booking_collection.insert_one(booking)`
  - Anti-Duplicate Profiling: `user_profiles_collection.update_one` maps the `phone` globally ensuring future logins synchronize correctly against historic data without duplicate tracking rows.

## 3. Conflict Monitoring
Administrators log into `/admin/bookings/`.
- The Django controller dynamically cross-references pending `date` requests natively. Any clashes natively inject HTML attributes displaying a `Conflict Detected` banner.

## 4. Agent Assignment
Admin selects an `Agent` string from the populated dropdown. Modifies the primary select dropdown from `Pending` -> `Approved` and submits.
- Hits `/api/bookings/update/<id>/` 
- Upgrades the MongoDB booking row globally appending `"broker_name" : "Agent XX"`.

## 5. User Acknowledgment
End users check `/profile/booked/`.
- NextJS contacts `/api/bookings/me/` querying their explicit primary phone number.
- Locates the modification. Modifies the frontend badge to Green (Approved) and securely displays the Agent's identity box confirming the assignment algorithm correctly matched.
