"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // 🔍 Trigger search on Enter
  const handleSearch = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" && search.trim()) {
      router.push(`/?q=${encodeURIComponent(search)}`);
    }
  };

  return (
    <nav className="bg-white shadow sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* LOGO */}
        <Link
          href="/"
          className="text-2xl font-bold text-red-600"
        >
          SiteHub
        </Link>

        {/* SEARCH */}
        <div className="flex-1 mx-6">
          <input
            type="text"
            placeholder="Search locations or site_code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full border border-gray-300 rounded-full px-4 py-2
                       focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-5">
          <Link
            href="/wishlist"
            className="text-gray-700 hover:text-red-600"
          >
            ❤️ Wishlist
          </Link>

          <Link
            href="/cart"
            className="text-gray-700 hover:text-red-600"
          >
            🛒 Cart
          </Link>

          <Link
            href="/upload-site"
            className="border border-red-600 text-red-600 px-4 py-2 rounded hover:bg-red-50"
          >
            ➕ Upload Site
          </Link>

          <Link
            href="/api/admin/bookings/"
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Admin
          </Link>
        </div>
      </div>
    </nav>
  );
}
