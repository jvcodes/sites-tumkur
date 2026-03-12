import urllib.request
import urllib.error
import sys

def check_url(url):
    print(f"Checking {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=5)
        print(f"Status: {response.getcode()}")
        print(f"Redirected URL: {response.geturl()}")
        return True
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code}")
    except urllib.error.URLError as e:
        print(f"URLError: {e.reason}")
    except Exception as e:
        print(f"Error: {e}")
    return False

print("--- Frontend Check ---")
check_url("http://localhost:3000/")
check_url("http://localhost:3000/api/admin/bookings/")
check_url("http://localhost:3000/api/admin/bookings")

print("\n--- Backend Check ---")
check_url("http://localhost:8000/admin/")
