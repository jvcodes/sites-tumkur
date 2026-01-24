"use client";

import { useEffect, useState } from "react";
import SiteCard from "../components/SiteCard";

interface Site {
  site_code: string;
  name: string;
  location: string;
  price: number;
  image?: string;
}

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<Site[]>([]);

  // ----------------------------------
  // LOAD & DEDUPLICATE WISHLIST (TYPE SAFE)
  // ----------------------------------
  useEffect(() => {
    const raw: Site[] = JSON.parse(
      localStorage.getItem("wishlist") || "[]"
    );

    const unique: Site[] = Array.from(
      new Map<string, Site>(
        raw.map((item) => [item.site_code, item])
      ).values()
    );

    setWishlist(unique);
  }, []);

  // ----------------------------------
  // REMOVE FROM WISHLIST
  // ----------------------------------
  const removeFromWishlist = (site_code: string) => {
    const updated: Site[] = wishlist.filter(
      (item) => item.site_code !== site_code
    );

    setWishlist(updated);
    localStorage.setItem(
      "wishlist",
      JSON.stringify(updated)
    );
  };

  // ----------------------------------
  // EMPTY STATE
  // ----------------------------------
  if (wishlist.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">
          My Wishlist
        </h2>
        <p className="text-gray-500">
          Your wishlist is empty ❤️
        </p>
      </div>
    );
  }

  // ----------------------------------
  // MAIN UI
  // ----------------------------------
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-semibold mb-6">
        My Wishlist
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {wishlist.map((site) => (
          <div
            key={site.site_code}   // ✅ STABLE UNIQUE KEY
            className="relative"
          >
            {/* REMOVE BUTTON */}
            <button
              onClick={() =>
                removeFromWishlist(site.site_code)
              }
              className="absolute top-2 left-2 bg-white border border-red-600 text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 z-10"
            >
              ❌ Remove
            </button>

            <SiteCard
              name={site.name}
              location={site.location}
              price={site.price}
              code={site.site_code}
              image={site.image}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
