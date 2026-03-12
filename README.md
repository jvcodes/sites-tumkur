# SiteHub Real Estate Platform

Welcome to the SiteHub project. This platform is designed for discovering and managing real estate sites in Tumkur.

## How to Run

The easiest way to run the project is using the automated launch script:

```powershell
# In PowerShell (root directory)
.\start_project.ps1
```

This script will:
1. Start the **Django Backend** in a new terminal.
2. Start the **Next.js Frontend** in another terminal.
3. Automatically open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Technical Details

### Backend (Django)
- **Tech Stack**: Django 6.0, Django REST Framework, MongoDB (via pymongo).
- **Environment**: Use the provided `venv`.
- **Manual Launch**: `.\venv\Scripts\python.exe manage.py runserver`

### Frontend (Next.js)
- **Tech Stack**: Next.js 15+, TypeScript, Tailwind CSS.
- **Manual Launch**: `cd frontend; npm run dev`

### Database (MongoDB)
- Ensure MongoDB Community Server is installed and running locally on port 27017.
- Database name: `sitehub_db`

---

## Setup Guide
For detailed setup instructions (first-time installation), see [SETUP.md](file:///c:/Users/jagad/Music/antigravity/sites-tumkur/SETUP.md).
