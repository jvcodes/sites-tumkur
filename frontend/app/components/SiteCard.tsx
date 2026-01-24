"use client";

import Link from "next/link";

interface SiteCardProps {
  name: string;
  location: string;
  price: number | string;
  code: string;
  image?: string; // ✅ FULL URL from backend
}

export default function SiteCard({
  name,
  location,
  price,
  code,
  image,
}: SiteCardProps) {

  // -----------------------------
  // ❤️ Add to Wishlist
  // -----------------------------
  const addToWishlist = () => {
    const wishlist = JSON.parse(
      localStorage.getItem("wishlist") || "[]"
    );

    if (wishlist.some((item: any) => item.code === code)) {
      alert("Already in wishlist");
      return;
    }

    wishlist.push({
      name,
      location,
      price,
      code,
      image,
    });

    localStorage.setItem(
      "wishlist",
      JSON.stringify(wishlist)
    );

    alert("Added to wishlist ❤️");
  };

  // -----------------------------
  // 🛒 Add to Cart
  // -----------------------------
  const addToCart = () => {
    const cart = JSON.parse(
      localStorage.getItem("cart") || "[]"
    );

    if (cart.some((item: any) => item.code === code)) {
      alert("Already in cart");
      return;
    }

    cart.push({
      name,
      location,
      price,
      code,
      image,
    });

    localStorage.setItem(
      "cart",
      JSON.stringify(cart)
    );

    alert("Added to cart 🛒");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">

      {/* 🔴 PRICE BADGE */}
      <div className="absolute top-3 right-3 bg-red-600 text-white text-sm px-3 py-1 rounded z-10">
        ₹{price}
      </div>

      {/* 🖼 IMAGE */}
      <Link href={`/site/${code}`}>
        <img
          src={image || "/no-image.png"}
          alt={name}
          className="h-44 w-full object-cover cursor-pointer"
        />
      </Link>

      {/* CONTENT */}
      <div className="p-4">
        <div className="flex justify-between items-start">
          <Link href={`/site/${code}`}>
            <h3 className="text-lg font-semibold text-gray-800 hover:text-red-600 cursor-pointer">
              {name}
            </h3>
          </Link>

          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
            Approved
          </span>
        </div>

        <p className="text-sm text-gray-500 mt-1">
          📍 {location}
        </p>

        {/* ACTIONS */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={addToWishlist}
            className="text-gray-500 hover:text-red-600 text-lg"
            title="Add to Wishlist"
          >
            ❤️
          </button>

          <button
            onClick={addToCart}
            className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 text-sm"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
