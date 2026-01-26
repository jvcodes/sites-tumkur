# Admin Dashboard & Site Management

## Overview
The SiteHub application features a custom **Admin Dashboard** for managing real estate site listings. This dashboard allows administrators to approve, reject, and edit site submissions.

## Access Links

| Feature | URL | Description |
| :--- | :--- | :--- |
| **Dashboard** | `http://localhost:3000/dashboard` | Main overview of pending sites. |
| **Approved Sites** | `http://localhost:3000/dashboard/approved/` | List of all publicly visible sites. |
| **Rejected Sites** | `http://localhost:3000/rejected/` | List of rejected sites. |
| **Django Admin** | `http://localhost:3000/admin` | Standard Django user management. |

## Credentials
To access the dashboard and perform actions, use the Superuser account:

- **Username**: `admin`
- **Password**: `admin123`

> **Note**: If you need to reset this password or create a new superuser, run the script:
> `python debug/create_superuser.py`

## Features

### 1. Site Approval Workflow
- **Upload**: Users upload sites via the "Upload Site" page. Initial status is `pending`.
- **Review**: The Dashboard lists all `pending` sites.
- **Action**: Admins can **Approve** (makes site public) or **Reject** (hides site).

### 2. Editing Sites
- Admins can edit any site (Price, Area, Owner, etc.) via the **Edit** button on the Approved Sites list.
- **Important**: Editing an `approved` site will reset its status to `pending` (requiring re-approval) to ensure quality control.

## Troubleshooting

### Redirect Loops
If you encounter a "page isn't redirecting properly" error on `/dashboard`:
- Ensure `next.config.ts` has the correct rewrite rules with **trailing slashes**.
- We maintain a specific configuration to handle Django's slash appending behavior.

### Images
- Images are stored locally on the filesystem in the `media/` directory.
- The MongoDB database stores only the *reference path* (e.g., `/media/site_images/plot.jpg`).
