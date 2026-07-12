# 🔐 Authentication — TumkurSites

This document describes how phone number OTP authentication works in the TumkurSites app.

---

## Overview

Users log in using their **Indian mobile phone number**. A 6-digit OTP is sent via SMS, verified by Firebase, and then the backend creates/fetches a user session.

**No passwords are used anywhere in this system.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| OTP Delivery | Firebase Authentication (Phone Auth) |
| Bot Protection | Firebase Invisible reCAPTCHA v3 |
| Token Verification | Firebase Admin SDK (Python) |
| Session Token | Django REST Framework `Token` |
| User Profile | MongoDB (`user_profiles` collection) |
| User Account | Django `auth_user` table |

---

## Authentication Flow

```
User enters phone number
        │
        ▼
Firebase sends OTP via SMS
(invisible reCAPTCHA runs in background)
        │
        ▼
User enters 6-digit OTP
        │
        ▼
Firebase verifies OTP client-side
→ Returns a signed Firebase ID Token (JWT)
        │
        ▼
Frontend POSTs idToken to /api/auth/phone
        │
        ▼
Django backend verifies idToken with Firebase Admin SDK
→ Extracts phone number from token (e.g. +917353565562)
→ Strips to last 10 digits (e.g. 7353565562)
        │
        ▼
Django looks up or creates Django auth_user
(username = 10-digit phone, email = phone@placeholder.com)
        │
        ▼
Django looks up or creates MongoDB user_profiles document
(phone, name="New User", email="", role="Buyer")
        │
        ▼
Returns { token, user: { phone, name, email, role } }
        │
        ▼
Frontend stores token + user in localStorage
AuthContext loads user into React state
```

---

## Firebase Setup

**Project:** `tumkuru-sites`
**Firebase Console:** https://console.firebase.google.com/project/tumkuru-sites

### Config (`frontend/firebaseConfig.ts`)

```ts
const firebaseConfig = {
  apiKey: "AIzaSyAvCXxxDD1UFJVq5WuXbaFvBfAIsEGcyTg",
  authDomain: "tumkuru-sites.firebaseapp.com",
  projectId: "tumkuru-sites",
  storageBucket: "tumkuru-sites.firebasestorage.app",
  messagingSenderId: "974580685297",
  appId: "1:974580685297:web:30ecadd033898674214c50",
};
```

### Firebase Admin SDK (`api/firebase_admin_setup.py`)
The backend uses the Firebase Admin SDK to verify ID tokens server-side.
The service account key file is required and must be present at the path configured in `firebase_admin_setup.py`.

---

## Frontend Code

**File:** `frontend/app/login/page.tsx`

### Step 1 — Send OTP
```ts
// Formats number with +91 prefix if not provided
const formattedNumber = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;

// Uses Firebase invisible reCAPTCHA
const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
```

### Step 2 — Verify OTP
```ts
// Verifies OTP with Firebase
const result = await confirmationResult.confirm(otp);

// Gets a signed ID token from Firebase
const idToken = await result.user.getIdToken();

// Sends to our backend
await loginWithPhone(idToken);
```

### Step 3 — Backend Login (`AuthContext.tsx`)
```ts
const res = await fetch("/api/auth/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
});
// Stores { token, user } in localStorage
```

---

## Backend Code

**File:** `api/auth_views.py` — `phone_auth_api()`

```python
# 1. Verify Firebase token
decoded_token = firebase_auth.verify_id_token(id_token)
phone_number = decoded_token.get('phone_number')  # e.g. +917353565562

# 2. Normalize to 10 digits
digits = re.sub(r'\D', '', phone_number)
phone_number = digits[-10:]  # e.g. 7353565562

# 3. Get or create Django user (username = phone)
user, created = User.objects.get_or_create(username=phone_number)

# 4. Get or create MongoDB profile
user_profiles_collection.insert_one({
    "phone": phone_number,
    "name": "New User",
    "email": "",
    "role": "Buyer",
})

# 5. Return Django REST token + profile
return Response({ "token": token.key, "user": { ... } })
```

---

## API Endpoints

| Method | URL | Description |
|---|---|---|
| `POST` | `/api/auth/phone` | Verify Firebase ID token, login/register user |
| `GET` | `/api/auth/profile/me` | Fetch user profile (`?phone=` or `?email=`) |
| `POST` | `/api/auth/update-profile` | Update name or email |
| `POST` | `/api/auth/update-phone` | Update phone number (for Google-login users) |
| `POST` | `/api/auth/google` | Google login (email + name) |

---

## Phone Number Normalization

Firebase returns phone numbers with a country code prefix (e.g. `+917353565562`).
All backend lookups normalize to the **last 10 digits** to ensure consistent MongoDB keys:

```python
digits = re.sub(r'\D', '', phone)    # strip all non-digits -> "917353565562"
phone  = digits[-10:]                # take last 10        -> "7353565562"
```

This normalization is applied in:
- `api/auth_views.py`
- `api/visits_views.py`
- `api/wishlist_views.py`

---

## User Profile Storage

Profiles are stored in **MongoDB** (`user_profiles` collection), separate from Django's `auth_user` table.

| Field | Type | Description |
|---|---|---|
| `phone` | `string` | 10-digit Indian mobile number (primary key for phone users) |
| `email` | `string` | Email address (primary key for Google users) |
| `name` | `string` | Display name (default: `"New User"`) |
| `role` | `string` | `"Buyer"` or `"Agent"` |
| `created_at` | `datetime` | Account creation timestamp |

---

## Session Management

| Item | Detail |
|---|---|
| Token type | Django REST Framework `Token` |
| Token storage | `authtoken_token` table (Django DB) |
| Frontend storage | `localStorage` keys: `token` and `user` |
| Context | `AuthContext.tsx` hydrates from `localStorage` on page load |
| Logout | Clears `localStorage`, redirects to `/login` |

---

## Known Constraints

- Phone number must be a valid **Indian mobile number** — starts with 6–9, exactly 10 digits
- Firebase Phone Auth requires a real SMS-capable device/SIM (not emulators without setup)
- The reCAPTCHA is **invisible** — no checkbox or user interaction needed
- New users always get `name = "New User"` — they can update it from the `/profile` page
- The Google login endpoint (`/api/auth/google`) does **not** verify the Google OAuth token — it trusts the email sent by the frontend. **Production hardening needed** before launch.
