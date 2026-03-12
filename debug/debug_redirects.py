import urllib.request
import urllib.error

def debug_url(url):
    print(f"Checking {url}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req, timeout=5)
        print(f"Final Status: {res.getcode()}")
        print(f"Final URL: {res.geturl()}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code}")
        print(f"Headers: {e.headers}")
    except Exception as e:
        print(f"Error: {e}")

debug_url("http://localhost:3000/dashboard/approved/")
