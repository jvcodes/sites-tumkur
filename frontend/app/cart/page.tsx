"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

import { useCart, CartItem } from "../context/CartContext";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../../lib/api-client";

export default function CartPage() {
  const { user, loading } = useAuth();
  const { cart, removeFromCart, clearCart } = useCart();
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<{name?: string, phone?: string} | null>(null);
  
  const [bookingReceipt, setBookingReceipt] = useState<{
    name: string; phone: string; date: string; time: string;
    sites: CartItem[]; ref: string;
  } | null>(null);

  // Cart loads automatically via context

  // ----------------------------------
  // LOAD PROFILE DATA
  // ----------------------------------
  const { data: profileData, isLoading: profileLoadingData } = useQuery({
    queryKey: ['profile', user?.email, user?.phone],
    queryFn: () => {
      const queryParam = user?.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user?.phone || "")}`;
      return fetchApi<{name?: string, phone?: string}>(`/api/auth/profile/me?${queryParam}`);
    },
    enabled: !!user && (!!user.email || !!user.phone) && !loading,
  });

  useEffect(() => {
    if (profileData) {
      setProfile(profileData);
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
    }
  }, [profileData]);

  useEffect(() => {
    if (profileLoadingData) {
      setProfileLoading(true);
    }
  }, [profileLoadingData]);

  // ----------------------------------
  // REMOVE FROM CART is handled by context
  // ----------------------------------

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
      clearCart();
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
        <h1 className="text-2xl font-semibold mb-3">Your Cart is Empty</h1>
        <p className="text-gray-500 mb-6">{message || "Add sites to your cart to schedule a visit."}</p>
        <Link href="/" className="inline-block bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">
          Browse Sites
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-10 font-sans">
      <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-4">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Your Visit List</h1>
        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm border border-red-200">
          {cart.length} Properties
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* LEFT: CART ITEMS */}
        <div className="lg:col-span-8 space-y-6">
          
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

              let warningColorClass = "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900";
              let icon = "🗺️";
              let warningMsg = `You have added ${cart.length} properties to your visit list. Please allocate approximately ${Math.ceil(cart.length * 45 / 60)} hours for your overall visit including transit times.`;

              if (maxDistance > 30) {
                warningColorClass = "bg-gradient-to-r from-purple-50 to-fuchsia-50 border-purple-200 text-purple-900";
                warningMsg = `These properties are spread very far apart (over 30km from the center). This visit might take a full day. Consider splitting this into two trips.`;
              } else if (maxDistance > 20) {
                warningColorClass = "bg-gradient-to-r from-orange-50 to-red-50 border-orange-200 text-orange-900";
                warningMsg = `These properties are quite far apart (over 20km from the center). Please expect significant driving time between locations.`;
              } else if (maxDistance > 10) {
                warningColorClass = "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-900";
                warningMsg = `Some of these properties are spread out (over 10km from the center). Please allocate extra time for travel.`;
              }

              return (
                <div className={`${warningColorClass} border shadow-sm p-5 rounded-2xl mb-6 transition-all`}>
                  <div className="flex items-start gap-4">
                    <div className="text-3xl bg-white p-2 rounded-xl shadow-sm">{icon}</div>
                    <div>
                      <h3 className="font-extrabold text-lg mb-1">Route & Time Estimation</h3>
                      <p className="text-sm font-medium opacity-90 leading-relaxed">
                        {warningMsg}
                      </p>
                    </div>
                  </div>
                </div>
              );
          })()}

          <div className="space-y-5">
            {cart.map((item) => (
              <div key={item.site_code} className="group relative flex flex-col sm:flex-row gap-6 bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.1)] transition-all duration-300">
                
                <Link href={`/site/${item.site_code}`} className="shrink-0 overflow-hidden rounded-xl">
                  <img
                    src={item.images?.[0] || item.image || "/no-image.svg"}
                    alt={item.name}
                    className="w-full sm:w-48 h-48 sm:h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>

                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <Link href={`/site/${item.site_code}`}>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors leading-tight">
                          {item.name}
                        </h3>
                      </Link>
                      <button
                        onClick={() => removeFromCart(item.site_code)}
                        className="bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        title="Remove from List"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1.5 font-medium">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {item.location}
                    </p>
                    
                    {/* Detailed Specifications */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {item.area ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                          <span className="text-xs font-bold text-gray-700">{item.area} Sq.ft</span>
                        </div>
                      ) : null}
                      
                      {item.dimension ? (
                        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-lg">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                          <span className="text-xs font-bold text-gray-700">{item.dimension}</span>
                        </div>
                      ) : null}
                      
                      {item.facing ? (
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-lg">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                          <span className="text-xs font-bold text-blue-700">{item.facing} Facing</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Asking Price</span>
                      <span className="text-2xl font-black text-gray-900 tracking-tight">
                        ₹{item.price >= 10000000 ? `${(item.price/10000000).toFixed(2)} Cr` : item.price >= 100000 ? `${(item.price/100000).toFixed(1)} L` : item.price.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <Link href={`/site/${item.site_code}`} className="group/btn flex items-center gap-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors">
                      View details
                      <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations Block */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border border-gray-200 mt-8 text-center flex flex-col items-center shadow-inner">
            <div className="bg-white p-4 rounded-full shadow-sm mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            </div>
            <h3 className="text-xl font-extrabold text-gray-900 mb-2">Want to explore more?</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">
              We recommend viewing at least 3-4 properties in a single trip to get a complete picture of the neighborhood.
            </p>
            <Link href="/" className="inline-block bg-white text-gray-900 shadow-sm border border-gray-200 font-bold px-8 py-3 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all">
              Continue Browsing
            </Link>
          </div>

        </div>

        {/* RIGHT: CHECKOUT */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-gray-100 p-6 sm:p-8 sticky top-24">
            <h2 className="text-xl font-extrabold mb-6 text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Schedule Visit
            </h2>
            
            <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-xl border border-green-100 mb-8 flex items-start gap-3">
              <span className="text-xl mt-0.5">✨</span>
              <div>
                <p className="font-bold text-emerald-900">100% Free Site Visit</p>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">Schedule a convenient time and an agent will assist you on location.</p>
              </div>
            </div>

            {/* Show logged-in user info */}
            {user ? (
              <div className="mb-6 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 ml-1">Your Name</label>
                  <div className="flex gap-2 items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50/50">
                    <span className="flex-1 text-gray-900 font-medium">{profile?.name || user.name || <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded">Update in Profile required</span>}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 ml-1">Phone Number</label>
                  <div className="flex gap-2 items-center border border-gray-200 rounded-xl px-4 py-3 bg-gray-50/50">
                    <span className="flex-1 text-gray-900 font-medium">
                      {profileLoading ? (
                        <span className="animate-pulse bg-gray-200 h-4 w-24 block rounded"></span>
                      ) : (profile?.phone || user.phone || <span className="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded">Update in Profile required</span>)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-4 rounded-xl flex gap-3 shadow-sm">
                  <span className="text-xl">🔐</span>
                  <p>
                    <strong>Sign in to continue.</strong> Your details will be loaded automatically to confirm the booking.
                  </p>
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 ml-1">Visit Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow text-gray-800 font-medium"
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-1.5 ml-1">Preferred Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow text-gray-800 font-medium"
                  required
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-medium">Sites Selected</span>
                <span className="bg-gray-800 text-white font-bold px-2 py-0.5 rounded-md">{cart.length}</span>
              </div>
            </div>

            <button
              id="submit-booking-btn"
              onClick={submitBooking}
              disabled={profileLoading}
              className="w-full bg-gradient-to-r from-red-600 to-rose-600 text-white py-4 rounded-xl hover:from-red-700 hover:to-rose-700 font-extrabold text-lg shadow-lg hover:shadow-red-600/25 transition-all disabled:opacity-50 disabled:hover:shadow-none"
            >
              {user ? "Confirm Booking Request" : "Sign in to Schedule"}
            </button>

            {message && (
              <div className="mt-6 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-5 py-4 rounded-xl flex gap-3 font-medium">
                <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                {message}
              </div>
            )}
          </div>
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
