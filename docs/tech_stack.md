# Technology Stack Documentation

This real estate listing and booking platform utilizes a modern decoupled setup separated into a frontend application and a backend API server.

## Frontend Architecture
- **Framework:** Next.js (React) utilizing the newer App Router (`app/` directory).
- **Styling:** Tailwind CSS for responsive and consistent visual design.
- **State Management:** React Hooks (`useState`, `useEffect`) and Context API (`AuthContext`) for global user state.
- **Routing:** Built-in Next.js file-based routing.

## Backend Architecture
- **Framework:** Django combined with Django REST Framework (DRF).
- **Views:** Function-based views annotated with `@api_view` for serving JSON payloads.
- **Routing:** Defined clearly in `urls.py`.

## Database Architecture
- **Database:** MongoDB
- **Driver:** `pymongo` (NoORM approach). We interface directly with the database without utilizing Django's built-in ORM system. This grants maximum control over documents, dynamic schemas (like storing a dynamic amount of images), and granular indexing.
- **Schema Management:** Manual collection definitions within `listings/mongo.py`.

## Infrastructure Configuration
- **CORS:** `django-cors-headers` is utilized to allow the NextJS frontend (running on `localhost:3000`) to communicate natively with the Django API (`localhost:8000`).
- **Media Storage:** Django handles saving local static media using the default file system storage driver (`default_storage`). Django settings define `MEDIA_URL` and `MEDIA_ROOT`.
