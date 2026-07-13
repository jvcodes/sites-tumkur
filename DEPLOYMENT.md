# Project Architecture & Account Summary

This document outlines the different platforms hosting your application, what each service does, and the account information used to set them up.

---

## Live Links

- **Production Website:** [https://tumkursites.com](https://tumkursites.com)
- **Vercel Temporary Domain:** [https://sites-tumkur-omega.vercel.app](https://sites-tumkur-omega.vercel.app)
- **Backend API Base URL:** [https://sites-tumkur.onrender.com](https://sites-tumkur.onrender.com)

## Account Information

- **Primary Email Used:** `jagadeeshtv1995@gmail.com`
- **GitHub Account:** `jvcodes`
- **GitHub Repository:** `https://github.com/jvcodes/sites-tumkur`

---

## 🚨 TODO: Upcoming Migration to Google Cloud Platform (GCP)
*We are planning to move the architecture to GCP to eliminate Render's 50-second cold start times while maintaining a $0/mo cost.*

**Planned Changes:**
1. **Frontend & Backend (Cloud Run):** Move Next.js and Django from Vercel/Render to **Google Cloud Run**. This requires creating `Dockerfile`s for both codebases. Cloud Run auto-scales and wakes up in ~1-2 seconds, falling well within the 2 million free requests/month tier.
2. **Image Storage (Google Cloud Storage):** Move local `/media/` image uploads to **GCS**. This prevents images from being deleted on every deployment. GCS provides 5GB free. Requires setting up `django-storages` and bucket CORS permissions.
3. **Database & Auth:** Keep MongoDB Atlas and Firebase, as they are already free and integrate perfectly.

---

## Cloud Platforms

| Component | Platform | What It Does & Why We Use It |
| :--- | :--- | :--- |
| **Domain Name** | **GoDaddy** | You purchased your custom domain (`tumkursites.com`) here. It provides the professional web address that users type into their browsers. |
| **Frontend** | **Vercel** | Vercel hosts your Next.js code (the user interface, buttons, and design). Vercel actually created Next.js, so they offer the fastest, zero-configuration hosting for it, completely for free. |
| **Backend** | **Render.com** | Render hosts your Django/Python code (the "brain" that processes logic and talks to the database). We use it because Vercel doesn't support Python servers, and Render is the easiest free platform for pulling Python code directly from GitHub. |
| **Database** | **MongoDB Atlas** | This stores all your property data, user profiles, and bookings. We use Atlas because it is the official cloud version of MongoDB, offering 512 MB for free forever, and required zero code rewrites to migrate your local data. |
| **OTP / SMS Auth** | **Firebase** | Firebase sends the 6-digit OTP SMS to users when they log in. It also verifies the OTP and issues a signed ID token which our backend validates. |
| **Source Code** | **GitHub** | This acts as the master backup for all your code. Both Vercel and Render are connected to it, so whenever we push an update to GitHub, your live website updates automatically. |

---

## Local Development vs Production

Your Next.js frontend has been configured to automatically switch its API endpoints depending on where it is running:
- When running locally (`npm run dev`), it fetches data from your local Django server (`http://127.0.0.1:8000`).
- When built and deployed to Vercel, it fetches data from your live Render server (`https://sites-tumkur.onrender.com`).

This is controlled in `frontend/next.config.ts`:
```ts
const isProd = process.env.NODE_ENV === 'production';
const backendUrl = isProd ? 'https://sites-tumkur.onrender.com' : 'http://127.0.0.1:8000';
```

---

## Firebase — OTP Authentication Setup

Firebase is used for phone number OTP login. Users enter their Indian mobile number, receive a 6-digit SMS code, and log in without a password.

**Firebase Project:** `tumkuru-sites`
**Firebase Console:** https://console.firebase.google.com/project/tumkuru-sites

### Services Used

| Firebase Service | Purpose |
|---|---|
| **Phone Authentication** | Sends OTP SMS to user's phone |
| **Invisible reCAPTCHA v3** | Bot protection before sending OTP |
| **Firebase Admin SDK** | Backend verifies the signed ID token |

### Frontend Config (`frontend/firebaseConfig.ts`)

These values come from the Firebase Console → Project Settings → Your Apps:

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

### Backend Setup (Firebase Admin SDK)

The Django backend verifies Firebase ID tokens using the **Firebase Admin SDK**.

1. Go to Firebase Console → Project Settings → **Service Accounts**
2. Click **Generate new private key** → download the JSON file
3. Save the file in your backend directory (e.g. `api/firebase-service-account.json`)
4. The path is configured in `api/firebase_admin_setup.py`

> ⚠️ Never commit the service account JSON file to GitHub. Add it to `.gitignore`.
> On Render, upload it as a **Secret File** in the environment settings.

### Enabling Phone Auth in Firebase Console

1. Go to Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Phone** as a sign-in provider
3. Add your production domain (`tumkursites.com`) to the **Authorized domains** list

---

## Environment Variables

### Backend (Render.com)

Set these in Render → Your Service → **Environment**:

| Variable | Example Value | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | `your-secret-key-here` | Django secret key for security |
| `DJANGO_DEBUG` | `False` | Must be `False` in production |
| `ALLOWED_HOSTS` | `sites-tumkur.onrender.com,tumkursites.com` | Allowed request origins |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster0...` | MongoDB Atlas connection string |
| `FIREBASE_CREDENTIALS_PATH` | `/etc/secrets/firebase-service-account.json` | Path to Firebase service account |

### Frontend (Vercel)

Set these in Vercel → Your Project → **Settings → Environment Variables**:

| Variable | Example Value | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSy...` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `tumkuru-sites` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:974...` | Firebase app ID |

> Currently, Firebase config is hardcoded in `frontend/firebaseConfig.ts`. Moving these to environment variables is recommended before public launch.

---

## MongoDB Atlas Setup

**Cluster:** `Cluster0`
**Connection String:** `mongodb+srv://admin:<password>@cluster0.p0dnt.mongodb.net/`
**Database:** `real_estate_db`

### Collections

| Collection | What it stores |
|---|---|
| `listings` | All property/site listings |
| `user_profiles` | User profiles (name, phone, email, role) |
| `wishlists` | Sites saved to wishlist by users |
| `visits` | Site visit history |
| `bookings` | Visit bookings made by users |

### Network Access

In MongoDB Atlas → **Network Access**, you must whitelist:
- `0.0.0.0/0` — Allow access from anywhere (required for Render.com since it has dynamic IPs)

---

## Deployment Steps

### [NEW] Google Cloud Platform (Cloud Run)

The application is now containerized and ready to be deployed to Google Cloud Run for $0/month. We use environment variables (`.env`) to ensure the codebase remains clean and can be deployed anywhere without code changes.

**Prerequisites:**
1. Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install).
2. Run `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID`.
3. Create a Google Cloud Storage Bucket for media (e.g. `gs://tumkur-sites-media`) and make it public.

**Deploy Backend (Django):**
```bash
# Run from the root directory of the project
gcloud run deploy sitehub-backend --source . --region us-central1 --allow-unauthenticated \
  --set-env-vars="DJANGO_SECRET_KEY=your-secret,MONGO_URI=your-mongo-uri,GS_BUCKET_NAME=tumkur-sites-media,GOOGLE_CLOUD_PROJECT=your-google-project-id"
```
*(Note: `GOOGLE_CLOUD_PROJECT` is strictly required for the Python Firebase Admin SDK to verify authentication tokens when using Cloud Run's Application Default Credentials).*

**Deploy Frontend (Next.js):**
Because Next.js bakes `NEXT_PUBLIC_` environment variables into the optimized bundle during the build phase, you must use `--set-build-env-vars` when deploying to Cloud Run.

```bash
# Run from the frontend/ directory
gcloud run deploy sitehub-frontend --source . --region us-central1 --allow-unauthenticated \
  --set-build-env-vars="NEXT_PUBLIC_BACKEND_URL=https://<your-backend-cloud-run-url>" \
  --set-env-vars="NEXT_PUBLIC_BACKEND_URL=https://<your-backend-cloud-run-url>"
```

---

### Backend — Deploy to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo (`jvcodes/sites-tumkur`)
4. Set **Root Directory** to ` ` (the repo root, not a subfolder)
5. Set **Build Command:** `pip install -r requirements.txt`
6. Set **Start Command:** `gunicorn sitehub.wsgi:application`
7. Add all environment variables listed above
8. Upload `firebase-service-account.json` as a **Secret File** at `/etc/secrets/firebase-service-account.json`
9. Deploy

### Frontend — Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repo (`jvcodes/sites-tumkur`)
4. Set **Root Directory** to `frontend`
5. Vercel auto-detects Next.js — no build command changes needed
6. Add environment variables if needed
7. Deploy

### Domain — Connect GoDaddy to Vercel

1. In Vercel → Your Project → **Settings → Domains** → Add `tumkursites.com`
2. Vercel gives you DNS records (CNAME or A records)
3. In GoDaddy → **DNS Management** → add those records
4. DNS propagation takes up to 48 hours

---

## How OTP Login Works End-to-End

```
User enters mobile number on /login
        ↓
Firebase sends OTP SMS (via Firebase Phone Auth)
        ↓
User enters 6-digit OTP
        ↓
Firebase verifies OTP → issues signed ID Token (JWT)
        ↓
Frontend POSTs { idToken } to https://sites-tumkur.onrender.com/api/auth/phone
        ↓
Django verifies token with Firebase Admin SDK
→ Extracts phone number (e.g. +917353565562)
→ Normalizes to 10 digits (7353565562)
→ Creates/fetches Django user + MongoDB profile
        ↓
Returns { token, user: { phone, name, email, role } }
        ↓
Frontend stores in localStorage → user is logged in
```

For full authentication documentation, see [AUTHENTICATION.md](./AUTHENTICATION.md).

---

## Local Development — Quick Start

### Backend
```bash
# From project root
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python manage.py runserver 127.0.0.1:8000
```

### Frontend
```bash
# From frontend/ directory
npm install
npm run dev
# Opens at http://localhost:3000
```
