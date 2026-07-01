"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import SiteCard from "../components/SiteCard";
import Link from "next/link";

export default function WishlistPage() {
  const { user } = useAuth();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      fetchWishlistItems(user.email);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchWishlistItems = async (email: string) => {
    try {
      const res = await fetch(
        `/api/wishlist/?email=${encodeURIComponent(email)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSites(data);
      }
    } catch (err) {
      console.error("Failed to load wishlist", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❤️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Required</h2>
          <p className="text-gray-500 mb-4">Please login to view your saved sites.</p>
          <Link
            href="/login"
            className="inline-block bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-2">
          My Wishlist ❤️
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          Sites you have saved — click ❤️ on any card to remove.
        </p>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-200">
            <div className="text-5xl mb-4">🏠</div>
            <p className="text-gray-600 font-medium mb-2">Your wishlist is empty</p>
            <p className="text-gray-400 text-sm mb-6">
              Tap the ❤️ on any site card to save it here.
            </p>
            <Link
              href="/"
              className="inline-block bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Browse Sites
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">{sites.length} saved site{sites.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {sites.map((site) => (
                <SiteCard key={site.id || site.site_code} site={site} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
