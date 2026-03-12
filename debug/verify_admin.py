import urllib.request
import urllib.error
import time
import sys

def check_url(url, name):
    print(f"Checking {name} at {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=5)
        code = response.getcode()
        print(f"[{name}] Status Code: {code}")
        if code == 200:
             print(f"[{name}] Admin page found!")
             return True
    except urllib.error.HTTPError as e:
        print(f"[{name}] HTTPError: {e.code}")
        # 302/301 redirects to login are also good signs
        if e.code in [301, 302]:
             print(f"[{name}] Admin page found (redirect)!")
             return True
        if e.code == 404:
             print(f"[{name}] 404 Not Found - Fix NOT working or server not ready.")
    except Exception as e:
        print(f"[{name}] Connection failed: {e}")
    return False

print("Verifying Admin Route...")
backend_ok = check_url("http://127.0.0.1:8000/dashboard/", "Backend Dashboard")
frontend_ok = check_url("http://localhost:3000/dashboard", "Frontend Dashboard")
approved_ok = check_url("http://localhost:3000/dashboard/approved/", "Frontend Approved Sites")

if backend_ok:
    print("\nSUCCESS: Backend admin route is accessible.")
else:
    print("\nFAILURE: Backend admin route is NOT accessible.")

if frontend_ok:
    print("SUCCESS: Frontend proxy is working.")
else:
    print("FAILURE: Frontend proxy is NOT working (or frontend server is down).")

if backend_ok:
    sys.exit(0)
else:
    sys.exit(1)
