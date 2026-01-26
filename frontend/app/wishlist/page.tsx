"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import SiteCard from "../components/SiteCard";

export default function WishlistPage() {
  const { user, token } = useAuth();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && token) {
      fetchWishlistItems();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  const fetchWishlistItems = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/wishlist/", {
        headers: { Authorization: `Token ${token}` },
      });
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Required</h2>
          <p className="text-gray-500 mb-4">Please login to view your saved sites.</p>
          <a href="/login" className="text-[var(--color-primary)] font-medium hover:underline">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-primary)] mb-8">
          My Wishlist ❤️
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500 text-lg">Your wishlist is empty.</p>
            <a href="/" className="inline-block mt-4 text-[var(--color-accent)] font-medium hover:underline">
              Browse Sites
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {sites.map((site) => (
              <SiteCard key={site._id || site.id} site={site} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
