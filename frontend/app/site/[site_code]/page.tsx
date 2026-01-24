"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Site {
  site_code: string;
  name: string;
  location: string;
  price: number;
  area?: number;
  owner?: string;
  description?: string;
  image?: string;
}

export default function SiteDetails() {
  const params = useParams();
  const siteCode = params.site_code as string;

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inCart, setInCart] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  // ----------------------------------
  // FETCH SITE DETAILS
  // ----------------------------------
  useEffect(() => {
    const fetchSite = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `http://127.0.0.1:8000/api/sites/${siteCode}/`
        );

        if (!res.ok) {
          throw new Error("Site not found");
        }

        const data: Site = await res.json();
        setSite(data);
        setError(null);
      } catch {
        setError("Failed to load site details");
      } finally {
        setLoading(false);
      }
    };

    fetchSite();
  }, [siteCode]);

  // ----------------------------------
  // CHECK CART & WISHLIST STATUS
  // (handles old + new stored data)
  // ----------------------------------
  useEffect(() => {
    if (!site) return;

    const cartRaw = JSON.parse(
      localStorage.getItem("cart") || "[]"
    );
    const wishlistRaw = JSON.parse(
      localStorage.getItem("wishlist") || "[]"
    );

    setInCart(
      cartRaw.some(
        (item: any) =>
          (item.site_code || item.code) === site.site_code
      )
    );

    setInWishlist(
      wishlistRaw.some(
        (item: any) =>
          (item.site_code || item.code) === site.site_code
      )
    );
  }, [site]);

  // ----------------------------------
  // ❤️ ADD TO WISHLIST (SAFE)
  // ----------------------------------
  const addToWishlist = () => {
    if (!site || inWishlist) return;

    const raw = JSON.parse(
      localStorage.getItem("wishlist") || "[]"
    );

    // normalize + deduplicate
    const normalized = [
      ...raw,
      site,
    ].map((item: any) => ({
      ...item,
      site_code: item.site_code || item.code,
    }));

    const unique = Array.from(
      new Map(
        normalized.map((i: Site) => [i.site_code, i])
      ).values()
    );

    localStorage.setItem(
      "wishlist",
      JSON.stringify(unique)
    );

    setInWishlist(true);
    alert("Added to wishlist ❤️");
  };

  // ----------------------------------
  // 🛒 ADD TO CART (SAFE)
  // ----------------------------------
  const addToCart = () => {
    if (!site || inCart) return;

    const raw = JSON.parse(
      localStorage.getItem("cart") || "[]"
    );

    // normalize + deduplicate
    const normalized = [
      ...raw,
      site,
    ].map((item: any) => ({
      ...item,
      site_code: item.site_code || item.code,
    }));

    const unique = Array.from(
      new Map(
        normalized.map((i: Site) => [i.site_code, i])
      ).values()
    );

    localStorage.setItem(
      "cart",
      JSON.stringify(unique)
    );

    setInCart(true);
    alert("Added to cart 🛒");
  };

  // ----------------------------------
  // UI STATES
  // ----------------------------------
  if (loading) {
    return (
      <p className="text-center mt-10">
        Loading site details...
      </p>
    );
  }

  if (error || !site) {
    return (
      <p className="text-red-600 text-center mt-10">
        {error}
      </p>
    );
  }

  // ----------------------------------
  // MAIN UI
  // ----------------------------------
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* LEFT: IMAGE */}
        <div>
          <img
            src={site.image || "/no-image.png"}
            alt={site.name}
            className="w-full h-80 object-cover rounded-lg border"
          />
        </div>

        {/* RIGHT: DETAILS */}
        <div>
          <h1 className="text-3xl font-bold mb-2 text-gray-800">
            {site.name}
          </h1>

          <p className="text-gray-500 mb-2">
            📍 {site.location}
          </p>

          <p className="text-2xl font-semibold text-red-600 mb-6">
            ₹ {site.price}
          </p>

          <div className="space-y-2 text-gray-700 text-sm">
            <p>
              <b>Site Code:</b> {site.site_code}
            </p>

            {site.area && (
              <p>
                <b>Area:</b> {site.area} sq.ft
              </p>
            )}

            {site.owner && (
              <p>
                <b>Owner:</b> {site.owner}
              </p>
            )}
          </div>

          {site.description && (
            <p className="mt-6 text-gray-700 leading-relaxed">
              {site.description}
            </p>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={addToCart}
              disabled={inCart}
              className={`px-6 py-2 rounded text-white ${
                inCart
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {inCart ? "Added to Cart" : "Add to Cart"}
            </button>

            <button
              onClick={addToWishlist}
              disabled={inWishlist}
              className={`px-6 py-2 rounded border ${
                inWishlist
                  ? "border-gray-400 text-gray-400 cursor-not-allowed"
                  : "border-red-600 text-red-600 hover:bg-red-50"
              }`}
            >
              {inWishlist ? "❤️ In Wishlist" : "❤️ Wishlist"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
