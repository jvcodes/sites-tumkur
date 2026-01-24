# Project Setup Guide

This guide will help you set up the **SiteHub** real estate application on a new machine or re-install it locally.

## Prerequisites

1.  **Python** (3.10 or higher)
2.  **Node.js** (LTS version recommended)
3.  **MongoDB** (Community Server)

### 1. Install & Start MongoDB
If you haven't installed MongoDB yet:
- **Windows**: [Download & Install MongoDB Community Server](https://www.mongodb.com/try/download/community)
- Ensure the service is running. You can check by running `mongosh` in your terminal.

---

## Backend Setup (Django)

1.  **Clone the Repository** (if on a new machine)
    ```bash
    git clone <your-repo-url>
    cd sites-tumkur
    ```

2.  **Create Virtual Environment**
    ```bash
    # Windows
    python -m venv venv
    ```

3.  **Activate Virtual Environment**
    ```bash
    # Windows
    venv\Scripts\activate
    ```

4.  **Install Dependencies**
    All required packages (Django, MongoDB driver, Image library, etc.) are listed in `requirements.txt`.
    ```bash
    pip install -r requirements.txt
    ```

5.  **Seed Sample Data (Optional)**
    If your database is empty, load sample sites:
    ```bash
    python seed_data.py
    ```

6.  **Run Backend Server**
    ```bash
    python manage.py runserver
    ```
    The server will start at `http://127.0.0.1:8000/`.

---

## Frontend Setup (Next.js)

Open a **new terminal** window (leave the backend running) and navigate to the frontend folder.

1.  **Navigate to Frontend**
    ```bash
    cd frontend
    ```

2.  **Install Node Dependencies**
    ```bash
    npm install
    ```

3.  **Run Frontend Server**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

---

## Troubleshooting

-   **Backend Images Not Showing?**
    Ensure `Pillow` is installed: `pip install Pillow` (It should be in requirements.txt now).

-   **"ModuleNotFoundError"?**
    Make sure your virtual environment is activated (`(venv)` should appear in your prompt).

-   **"Connection Refused" (Mongo)?**
    Make sure MongoDB service is running locally on port `27017`.
    
    To check if it's running on Windows, run this in your terminal:
    ```bash
    # If using Command Prompt (cmd)
    sc query "MongoDB"

    # If using PowerShell (sc is an alias, use sc.exe or Get-Service)
    sc.exe query "MongoDB"
    # OR
    Get-Service "MongoDB"
    ```
    If it's stopped, start it via "Services" app or run `net start MongoDB` (as Admin).
