"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

interface CartItem {
  site_code: string;
  name: string;
  location: string;
  price: number;
  image?: string;
}

export default function CartPage() {
  const { user, loading } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // ----------------------------------
  // LOAD, NORMALIZE & DEDUPLICATE CART
  // ----------------------------------
  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    const normalized: CartItem[] = raw.map((item: any) => ({
      site_code: item.site_code || item.code,
      name: item.name,
      location: item.location,
      price: Number(item.price),
      image: item.image,
    }));
    const unique = Array.from(
      new Map<string, CartItem>(normalized.map((item) => [item.site_code, item])).values()
    );
    setCart(unique);
    localStorage.setItem("cart", JSON.stringify(unique));
  }, []);

  // ----------------------------------
  // AUTO-FILL FROM SESSION ON LOGIN
  // ----------------------------------
  useEffect(() => {
    if (!user || loading) return;

    // Auto-fill name immediately from auth context
    setName(user.name || "");

    // Fetch phone from profile API
    if (user.email) {
      setProfileLoading(true);
      fetch(`http://127.0.0.1:8000/api/auth/profile/me/?email=${encodeURIComponent(user.email)}`)
        .then((r) => r.json())
        .then((profile) => {
          if (profile.phone) setPhone(profile.phone);
        })
        .catch(() => {})
        .finally(() => setProfileLoading(false));
    }
  }, [user, loading]);

  // ----------------------------------
  // REMOVE FROM CART
  // ----------------------------------
  const removeFromCart = (site_code: string) => {
    const updated = cart.filter((item) => item.site_code !== site_code);
    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
  };

  // ----------------------------------
  // SUBMIT BOOKING
  // ----------------------------------
  const submitBooking = async () => {
    // Gate: must be logged in
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (!name || !phone || !date || !time) {
      alert("Please fill all booking details including date and time");
      return;
    }

    const bookingData = {
      name,
      phone,
      date,
      time,
      email: user.email,
      sites: cart,
    };

    try {
      const res = await fetch("http://127.0.0.1:8000/api/bookings/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      if (!res.ok) throw new Error("Booking failed");
      localStorage.removeItem("cart");
      setCart([]);
      setMessage("✅ Booking request submitted successfully! We'll contact you soon.");
    } catch {
      alert("❌ Failed to submit booking. Please try again.");
    }
  };

  // ----------------------------------
  // EMPTY CART STATE
  // ----------------------------------
  if (!loading && cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-2xl font-semibold mb-3">Your Cart is Empty</h2>
        <p className="text-gray-500 mb-6">{message || "Add sites to your cart to schedule a visit."}</p>
        <Link href="/" className="inline-block bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">
          Browse Sites
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">My Cart ({cart.length})</h1>

      {/* Login prompt overlay — cart data is preserved */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-4">🔐</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Sign in to continue</h2>
            <p className="text-gray-500 text-sm mb-6">
              Your cart is saved. Please sign in to submit your visit booking.
            </p>
            <Link
              href={`/login?redirect=/cart`}
              className="block w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Sign In with Google
            </Link>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="block w-full mt-3 text-gray-500 text-sm hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: CART ITEMS */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div key={item.site_code} className="flex gap-4 bg-white rounded-lg shadow-sm p-4">
              <img
                src={item.image || "/no-image.png"}
                alt={item.name}
                className="w-36 h-28 object-cover rounded border"
              />
              <div className="flex-1">
                <Link href={`/site/${item.site_code}`}>
                  <h3 className="text-lg font-semibold hover:text-red-600">{item.name}</h3>
                </Link>
                <p className="text-sm text-gray-500 mt-1">📍 {item.location}</p>
                <p className="text-red-600 font-semibold mt-2">₹ {item.price.toLocaleString()}</p>
                <button
                  onClick={() => removeFromCart(item.site_code)}
                  className="text-sm text-red-600 mt-3 hover:underline"
                >
                  ❌ Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: CHECKOUT */}
        <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
          <h2 className="text-lg font-semibold mb-4">Booking Details</h2>

          {/* Show logged-in user info OR editable fields */}
          {user ? (
            <div className="mb-4">
              {/* Name — read-only if logged in */}
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-500 block mb-1">Your Name</label>
                <div className="flex gap-2 items-center border rounded px-3 py-2 bg-gray-50">
                  <span className="flex-1 text-gray-800">{name || user.name}</span>
                  <span className="text-green-500 text-xs font-bold">✓ from account</span>
                </div>
              </div>

              {/* Phone — editable if not fetched yet */}
              <div className="mb-3">
                <label className="text-xs font-bold text-gray-500 block mb-1">Phone Number</label>
                {profileLoading ? (
                  <div className="border rounded px-3 py-2 bg-gray-50 text-gray-400 text-sm">
                    Loading from profile...
                  </div>
                ) : phone ? (
                  <div className="flex gap-2 items-center border rounded px-3 py-2 bg-gray-50">
                    <span className="flex-1 text-gray-800">{phone}</span>
                    <span className="text-green-500 text-xs font-bold">✓ from account</span>
                  </div>
                ) : (
                  <input
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                )}
              </div>
            </div>
          ) : (
            /* Not logged in — show editable fields + subtle login nudge */
            <div className="mb-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg mb-3">
                💡 <strong>Sign in</strong> to auto-fill your name and phone.{" "}
                <Link href="/login?redirect=/cart" className="underline font-semibold">Login</Link>
              </div>
              <input
                type="text"
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          )}

          {/* Date & Time */}
          <div className="flex gap-2 mb-5">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 block mb-1">Visit Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 block mb-1">Preferred Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                required
              />
            </div>
          </div>

          <div className="flex justify-between text-sm mb-5 pb-4 border-b text-gray-600">
            <span>Sites to visit</span>
            <span className="font-bold text-gray-800">{cart.length}</span>
          </div>

          <button
            onClick={submitBooking}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-semibold transition"
          >
            {user ? "Submit Visit Request" : "Sign in & Submit"}
          </button>

          {message && (
            <div className="mt-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
