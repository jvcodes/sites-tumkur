"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

interface CartItem {
  site_code: string;
  name: string;
  location: string;
  price: number;
  image?: string;
  images?: string[];
  latitude?: number;
  longitude?: number;
}

export default function CartPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<{name?: string, phone?: string} | null>(null);
  
  const [bookingReceipt, setBookingReceipt] = useState<{
    name: string; phone: string; date: string; time: string;
    sites: CartItem[]; ref: string;
  } | null>(null);

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
      images: item.images,
      latitude: item.latitude ? Number(item.latitude) : undefined,
      longitude: item.longitude ? Number(item.longitude) : undefined,
    }));
    const unique = Array.from(
      new Map<string, CartItem>(normalized.map((item) => [item.site_code, item])).values()
    );
    setCart(unique);
    localStorage.setItem("cart", JSON.stringify(unique));
  }, []);

  // ----------------------------------
  // LOAD PROFILE DATA
  // ----------------------------------
  useEffect(() => {
    if (!user || loading) return;

    if (user.email || user.phone) {
      setProfileLoading(true);
      const queryParam = user.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user.phone || "")}`;
      fetch(`/api/auth/profile/me?${queryParam}`)
        .then((r) => r.json())
        .then((data) => {
          setProfile(data);
        })
        .catch(() => {})
        .finally(() => {
           setProfileLoading(false);
           
           // Auto-submit check after profile is loaded
           if (sessionStorage.getItem("cart_pending_submit") === "true") {
              sessionStorage.removeItem("cart_pending_submit");
              const savedDate = sessionStorage.getItem("cart_date");
              const savedTime = sessionStorage.getItem("cart_time");
              if (savedDate) setDate(savedDate);
              if (savedTime) setTime(savedTime);

              setTimeout(() => {
                  document.getElementById("submit-booking-btn")?.click();
              }, 500);
           }
        });
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
    if (!date || !time) {
      toast.error("Please select a date and time for your visit.");
      return;
    }
    
    // Gate: must be logged in
    if (!user) {
      sessionStorage.setItem("cart_date", date);
      sessionStorage.setItem("cart_time", time);
      sessionStorage.setItem("cart_pending_submit", "true");
      router.push(`/login?redirect=/cart`);
      return;
    }

    // Gate: Profile must have name and phone
    const hasName = profile?.name || user.name;
    const hasPhone = profile?.phone || user.phone;
    
    if (!hasName || !hasPhone) {
      toast.error("Please update your profile with your Name and Phone Number to continue.");
      sessionStorage.setItem("cart_date", date);
      sessionStorage.setItem("cart_time", time);
      sessionStorage.setItem("cart_pending_submit", "true");
      router.push('/profile');
      return;
    }

    const bookingData = {
      name: hasName,
      phone: hasPhone,
      date,
      time,
      email: user.email,
      sites: cart,
    };

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });
      if (!res.ok) throw new Error("Booking failed");
      const receiptData = {
        name: hasName as string,
        phone: hasPhone as string,
        date,
        time,
        sites: [...cart],
        ref: `BK${Date.now().toString().slice(-8)}`,
      };
      localStorage.removeItem("cart");
      setCart([]);
      setBookingReceipt(receiptData);
      setMessage("✅ Booking request submitted! Our team will call you within 24 hours to confirm your site visit.");
    } catch {
      toast.error("Booking failed. Please check your internet and try again.");
    }
  };

  // ----------------------------------
  // BOOKING RECEIPT — shown after successful submission
  // ----------------------------------
  if (bookingReceipt) {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-8">
        <div className="bg-white rounded-2xl shadow-lg border border-green-100 overflow-hidden">
          {/* Header */}
          <div className="bg-green-600 text-white px-8 py-6 text-center">
            <div className="text-5xl mb-3">✅</div>
            <h1 className="text-2xl font-extrabold">Booking Confirmed!</h1>
            <p className="text-green-100 mt-1 text-sm">Our team will call you within 24 hours</p>
          </div>

          {/* Booking Details */}
          <div className="px-8 py-6 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Booking Reference</p>
              <p className="text-2xl font-extrabold text-gray-800 tracking-widest">{bookingReceipt.ref}</p>
              <p className="text-xs text-gray-400 mt-1">Save this number for follow-up</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Your Name</p>
                <p className="font-bold text-gray-800">{bookingReceipt.name}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Mobile</p>
                <p className="font-bold text-gray-800">{bookingReceipt.phone}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Visit Date</p>
                <p className="font-bold text-gray-800">
                  {new Date(bookingReceipt.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-600 font-semibold uppercase mb-1">Preferred Time</p>
                <p className="font-bold text-gray-800">{bookingReceipt.time}</p>
              </div>
            </div>

            {/* Sites list */}
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Sites to Visit ({bookingReceipt.sites.length})</p>
              <div className="space-y-2">
                {bookingReceipt.sites.map((s) => (
                  <div key={s.site_code} className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                      <p className="text-xs text-gray-500">📍 {s.location} · {s.site_code}</p>
                    </div>
                    <p className="font-bold text-red-600 text-sm">
                      ₹{s.price >= 100000 ? `${(s.price/100000).toFixed(1)} L` : s.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
              <p className="text-yellow-800 text-sm font-medium">
                📞 We will call you on <strong>{bookingReceipt.phone}</strong> to confirm the visit schedule.
              </p>
            </div>
          </div>

          <div className="px-8 pb-8 flex gap-3">
            <Link href="/profile/booked" className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition">
              View My Bookings
            </Link>
            <Link href="/" className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition">
              Browse More
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------
  // EMPTY CART STATE
  // ----------------------------------
  if (loading) {
      return (
          <div className="max-w-4xl mx-auto p-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          </div>
      );
  }

  if (cart.length === 0) {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: CART ITEMS */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Time/Distance Estimation Warning */}
          {cart.length > 1 && (() => {
              let maxDistance = 0;
              let totalLat = 0, totalLng = 0;
              cart.forEach(item => {
                const coords = (item.latitude && item.longitude) 
                  ? { lat: item.latitude, lng: item.longitude } 
                  : getMockLatLong(item.site_code);
                totalLat += coords.lat;
                totalLng += coords.lng;
              });
              const avgLat = totalLat / cart.length;
              const avgLng = totalLng / cart.length;

              cart.forEach(item => {
                const coords = (item.latitude && item.longitude) 
                  ? { lat: item.latitude, lng: item.longitude } 
                  : getMockLatLong(item.site_code);
                const dist = getDistanceFromLatLonInKm(avgLat, avgLng, coords.lat, coords.lng);
                if (dist > maxDistance) {
                  maxDistance = dist;
                }
              });

              let warningColorClass = "bg-blue-50 border-blue-500 text-blue-800";
              let warningTextClass = "text-blue-600";
              let warningMsg = `You have added ${cart.length} properties to your visit list. Please allocate approximately ${cart.length * 45} minutes for your overall visit including transit times.`;

              if (maxDistance > 30) {
                warningColorClass = "bg-purple-50 border-purple-500 text-purple-800";
                warningTextClass = "text-purple-600";
                warningMsg = `These properties are spread very far apart (over 30km from the center). This visit might take a full day. Consider splitting this into two trips.`;
              } else if (maxDistance > 20) {
                warningColorClass = "bg-red-50 border-red-500 text-red-800";
                warningTextClass = "text-red-600";
                warningMsg = `These properties are quite far apart (over 20km from the center). Please expect significant driving time between locations.`;
              } else if (maxDistance > 10) {
                warningColorClass = "bg-yellow-50 border-yellow-500 text-yellow-800";
                warningTextClass = "text-yellow-700";
                warningMsg = `Some of these properties are spread out (over 10km from the center). Please allocate extra time for travel.`;
              }

              return (
                <div className={`${warningColorClass} border-l-4 p-4 rounded mb-4`}>
                  <h3 className="font-bold mb-1">🗓️ Multi-Site Visit Estimation</h3>
                  <p className={`${warningTextClass} text-sm`}>
                    {warningMsg}
                  </p>
                </div>
              );
          })()}

          {cart.map((item) => (
            <div key={item.site_code} className="flex gap-4 bg-white rounded-lg shadow-sm p-4">
              <img
                src={item.images?.[0] || item.image || "/no-image.svg"}
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

          {/* Recommendations Block */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 mt-6 text-center">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Tip: Pick 3 or 4 places</h3>
            <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
              It's best to visit a few places in one trip to see what you like.
            </p>
            <Link href="/" className="inline-block border-2 border-red-600 text-red-600 font-bold px-6 py-2 rounded hover:bg-red-50 transition">
              Add More Places
            </Link>
          </div>

        </div>

        {/* RIGHT: CHECKOUT */}
        <div className="bg-white rounded-lg shadow-sm p-6 h-fit">
          <h2 className="text-lg font-semibold mb-4">Booking Details</h2>
          
          <div className="bg-green-50 text-green-800 text-sm p-3 rounded-lg border border-green-200 mb-6">
            <p className="font-bold">Free to visit</p>
            <p className="text-xs mt-1 text-green-700">No pressure to buy. Just come and see.</p>
          </div>

          {/* Show logged-in user info */}
          {user ? (
            <div className="mb-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Your Name</label>
                <div className="flex gap-2 items-center border rounded px-3 py-2 bg-gray-50">
                  <span className="flex-1 text-gray-800">{profile?.name || user.name || <span className="text-red-500 text-xs font-bold">Missing - Update in Profile</span>}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Phone Number</label>
                <div className="flex gap-2 items-center border rounded px-3 py-2 bg-gray-50">
                  <span className="flex-1 text-gray-800">
                    {profileLoading ? "Loading..." : (profile?.phone || user.phone || <span className="text-red-500 text-xs font-bold">Missing - Update in Profile</span>)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg mb-3">
                💡 <strong>Sign in</strong> to proceed with scheduling. Your details will be loaded automatically.
              </div>
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
            id="submit-booking-btn"
            onClick={submitBooking}
            disabled={profileLoading}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 font-semibold transition disabled:opacity-50"
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

// ----------------------------------
// HELPERS FOR MOCK LAT/LONG CALCS
// ----------------------------------
function getMockLatLong(siteCode: string) {
  let hash = 0;
  for (let i = 0; i < siteCode.length; i++) {
    hash = siteCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Base coordinates around Tumkur
  const latOffset = (hash % 400) / 1000; // spread up to ~40km depending on hash
  const lngOffset = ((hash >> 4) % 400) / 1000;
  
  return {
    lat: 13.34 + latOffset,
    lng: 77.10 + lngOffset
  };
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2-lat1);
  const dLon = deg2rad(lon2-lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180);
}
