# Component: User Profile & Bookings

The User Profile service governs authentication checking and historic activity rendering.

## Frontend Layout (`frontend/app/profile/booked/page.tsx`)
- **Authentication:** `useAuth` hook grabs the session token dictating whether the user is logged in natively via Firebase/JWT.
- **Data Hook:** Uses the `useEffect` hook to send a `GET` request specifically requesting the authenticated user's `email`.
- **UI:** Iterates over the array response, generating cards showcasing:
  - The Status (Pending vs Approved).
  - The Assisting Agent (if assigned).
  - The explicitly chosen Scheduled Date AND Scheduled Time.
  - A summary of the properties carted.

## Backend Hook (`my_bookings_api`)
Located in `api/views.py`.
1. Extracts `email` and `phone` from query parameters.
2. If `phone` is missing (auth flow), falls back to querying `user_profiles_collection` using `email`.
3. If profile resolves, grabs the associated global `phone`.
4. Executes a broad search across `booking_collection` matching the globally resolved phone/email.
5. Returns JSON serialization with dates, times, and stringified `_id` values natively readable by NextJS.
