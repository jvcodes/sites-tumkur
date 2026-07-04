# Project Architecture & Account Summary

This document outlines the different platforms hosting your application, what each service does, and the account information used to set them up.

## Live Links
- **Production Website:** [https://tumkursites.com](https://tumkursites.com)
- **Vercel Temporary Domain:** [https://sites-tumkur-omega.vercel.app](https://sites-tumkur-omega.vercel.app)
- **Backend API Base URL:** [https://sites-tumkur.onrender.com](https://sites-tumkur.onrender.com)

## Account Information
- **Primary Email Used:** `jagadeeshtv1995@gmail.com`
- **GitHub Account:** `jvcodes`
- **GitHub Repository:** `https://github.com/jvcodes/sites-tumkur`

---

## Cloud Platforms

| Component | Platform | What It Does & Why We Use It |
| :--- | :--- | :--- |
| **Domain Name** | **GoDaddy** | You purchased your custom domain (`tumkursites.com`) here. It provides the professional web address that users type into their browsers. |
| **Frontend** | **Vercel** | Vercel hosts your Next.js code (the user interface, buttons, and design). Vercel actually created Next.js, so they offer the fastest, zero-configuration hosting for it, completely for free. |
| **Backend** | **Render.com** | Render hosts your Django/Python code (the "brain" that processes logic and talks to the database). We use it because Vercel doesn't support Python servers, and Render is the easiest free platform for pulling Python code directly from GitHub. |
| **Database** | **MongoDB Atlas** | This stores all your property data, user profiles, and bookings. We use Atlas because it is the official cloud version of MongoDB, offering 512 MB for free forever, and required zero code rewrites to migrate your local data. |
| **Source Code** | **GitHub** | This acts as the master backup for all your code. Both Vercel and Render are connected to it, so whenever we push an update to GitHub, your live website updates automatically. |

## Local Development vs Production

Your Next.js frontend has been configured to automatically switch its API endpoints depending on where it is running:
- When running locally (`npm run dev`), it fetches data from your local Django server (`http://127.0.0.1:8000`).
- When built and deployed to Vercel, it fetches data from your live Render server (`https://sites-tumkur.onrender.com`).
