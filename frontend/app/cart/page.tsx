"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CartItem {
  site_code: string;
  name: string;
  location: string;
  price: number;
  image?: string;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");

  // ----------------------------------
  // LOAD, NORMALIZE & DEDUPLICATE CART
  // ----------------------------------
  useEffect(() => {
    const raw = JSON.parse(
      localStorage.getItem("cart") || "[]"
    );

    // 🔥 Normalize old + new cart items
    const normalized: CartItem[] = raw.map((item: any) => ({
      site_code: item.site_code || item.code, // ✅ CRITICAL FIX
      name: item.name,
      location: item.location,
      price: Number(item.price),
      image: item.image,
    }));

    // ✅ Deduplicate safely by site_code
    const unique: CartItem[] = Array.from(
      new Map<string, CartItem>(
        normalized.map((item) => [item.site_code, item])
      ).values()
    );

    setCart(unique);

    // ✅ Persist fixed data back
    localStorage.setItem(
      "cart",
      JSON.stringify(unique)
    );
  }, []);

  // ----------------------------------
  // REMOVE FROM CART
  // ----------------------------------
  const removeFromCart = (site_code: string) => {
    const updated = cart.filter(
      (item) => item.site_code !== site_code
    );

    setCart(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
  };

  // ----------------------------------
  // TOTAL PRICE
  // ----------------------------------
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price,
    0
  );

  // ----------------------------------
  // SUBMIT BOOKING
  // ----------------------------------
  const submitBooking = async () => {
    if (!name || !phone || !date) {
      alert("Please fill all booking details");
      return;
    }

    const bookingData = {
      name,
      phone,
      date,
      sites: cart,
    };

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/bookings/create/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bookingData),
        }
      );

      if (!res.ok) throw new Error("Booking failed");

      localStorage.removeItem("cart");
      setCart([]);
      setMessage("✅ Booking request submitted successfully!");
    } catch {
      alert("❌ Failed to submit booking");
    }
  };

  // ----------------------------------
  // EMPTY CART
  // ----------------------------------
  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-10 text-center">
        <h2 className="text-2xl font-semibold mb-3">
          Your Cart is Empty 🛒
        </h2>
        <p className="text-gray-500 mb-6">
          {message || "Please add sites to continue"}
        </p>
        <Link
          href="/"
          className="inline-block bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
        >
          Browse Sites
        </Link>
      </div>
    );
  }

  // ----------------------------------
  // MAIN UI
  // ----------------------------------
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">
        My Cart ({cart.length})
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: CART ITEMS */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div
              key={item.site_code} // ✅ ALWAYS UNIQUE NOW
              className="flex gap-4 bg-white rounded-lg shadow-sm p-4"
            >
              <img
                src={item.image || "/no-image.png"}
                alt={item.name}
                className="w-36 h-28 object-cover rounded border"
              />

              <div className="flex-1">
                <Link href={`/site/${item.site_code}`}>
                  <h3 className="text-lg font-semibold hover:text-red-600">
                    {item.name}
                  </h3>
                </Link>

                <p className="text-sm text-gray-500 mt-1">
                  📍 {item.location}
                </p>

                <p className="text-red-600 font-semibold mt-2">
                  ₹ {item.price}
                </p>

                <button
                  onClick={() =>
                    removeFromCart(item.site_code)
                  }
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
          <h2 className="text-lg font-semibold mb-4">
            Booking Details
          </h2>

          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-3"
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-3"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded px-3 py-2 mb-4"
          />

          <div className="flex justify-between text-sm mb-2">
            <span>Total Sites</span>
            <span>{cart.length}</span>
          </div>

          <div className="flex justify-between text-lg font-semibold mb-6">
            <span>Total Amount</span>
            <span>₹ {totalPrice}</span>
          </div>

          <button
            onClick={submitBooking}
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
          >
            Submit Booking
          </button>

          {message && (
            <p className="text-green-600 text-sm mt-4">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
