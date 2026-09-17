# Testing on Local Network (Mobile/Tablet)

During development, you may want to preview the SiteHub application on a mobile phone, tablet, or another computer. Since both the frontend (Next.js) and backend (Django) run on `localhost` by default, other devices on your Wi-Fi network cannot connect to them out of the box.

Follow these steps to make your development servers accessible over your Local Area Network (LAN).

## 1. Find your computer's Local IP Address

You need the local IPv4 address of the computer running the code.
- **Windows**: Open Command Prompt / PowerShell and type `ipconfig`. Look for the `IPv4 Address` under your active Wi-Fi or Ethernet adapter (e.g., `192.168.1.14`).
- **Mac/Linux**: Open Terminal and type `ifconfig` or `ip a`.

## 2. Update the Frontend Environment

For your phone to be able to communicate with your backend API, you must tell the frontend to use the network IP instead of `localhost`.

1. Open `frontend/.env.local`
2. Change the backend URL to your local IP:
   ```env
   # Change this:
   # NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
   
   # To this (replace with your actual IP):
   NEXT_PUBLIC_BACKEND_URL=http://192.168.1.14:8000
   ```

## 3. Run the Servers with Network Binding (`0.0.0.0`)

By default, development servers bind to `127.0.0.1` (localhost only). You need to bind them to `0.0.0.0` to tell them to accept external connections from your router.

**Start the Django Backend:**
```bash
python manage.py runserver 0.0.0.0:8000
```

**Start the Next.js Frontend:**
```bash
cd frontend
npm run dev -- -H 0.0.0.0
```

## 4. Connect from your Mobile Device

1. Ensure your mobile device is connected to the **exact same Wi-Fi network**.
2. Open your mobile browser and navigate to:
   **`http://YOUR_LOCAL_IP:3000`** (e.g., `http://192.168.1.14:3000`)

---

## Troubleshooting: Windows Defender Firewall

If the page loads forever or says "Connection Timed Out" on your phone, **Windows Defender Firewall** is likely blocking incoming connections to Node.js and Python.

**Quick Fix:**
1. Press the Windows Key and type "Firewall".
2. Open **Windows Defender Firewall**.
3. Click **"Turn Windows Defender Firewall on or off"** on the left panel.
4. Temporarily turn off the firewall for **Private network settings**.
5. Refresh your phone browser.

*(Remember to turn the firewall back on when you are done testing, or explicitly add an inbound rule for TCP ports 3000 and 8000!)*
