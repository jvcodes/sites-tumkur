import urllib.request
import json
import sys

# 1. Get Token (Reusing the auth logic)
def get_token():
    url = "http://127.0.0.1:8000/api/auth/google/"
    payload = {"email": "debug@example.com", "name": "Debug User"}
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            res_json = json.loads(response.read().decode('utf-8'))
            return res_json['token']
    except Exception as e:
        print(f"Failed to get token: {e}")
        sys.exit(1)

# 2. Test Toggle
def test_toggle():
    token = get_token()
    print(f"Got Token: {token}")
    
    url = "http://127.0.0.1:8000/api/wishlist/toggle/"
    # Using a fake site_code
    payload = {"site_code": "DEBUG-SITE-001"}
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={
        'Content-Type': 'application/json',
        'Authorization': f'Token {token}'
    })
    
    try:
        print(f"POSTing to {url}...")
        with urllib.request.urlopen(req) as response:
            print(f"Status: {response.getcode()}")
            print(f"Response: {response.read().decode('utf-8')}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_toggle()
