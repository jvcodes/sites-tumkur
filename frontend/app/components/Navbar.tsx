"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { user, logout } = useAuth();

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
          className="text-2xl font-bold text-[var(--color-primary)] tracking-wide"
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
                       focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] bg-gray-50"
          />
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-5">
          <Link
            href="/wishlist"
            className="text-gray-700 hover:text-[var(--color-accent)] transition-colors"
          >
            ❤️ Wishlist
          </Link>

          <Link
            href="/cart"
            className="text-gray-700 hover:text-[var(--color-accent)] transition-colors"
          >
            🛒 Cart
          </Link>

          {user ? (
            <>
              <div className="flex flex-col items-end mr-2">
                <span className="text-xs text-gray-500">Welcome,</span>
                <span className="text-sm font-bold text-[var(--color-primary)]">{user.name}</span>
              </div>

              <button
                onClick={logout}
                className="text-gray-500 hover:text-red-600 text-sm font-medium"
              >
                Logout
              </button>

              <Link
                href="/upload-site"
                className="border border-[var(--color-primary)] text-[var(--color-primary)] px-4 py-2 rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-all"
              >
                ➕ Upload
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="bg-[var(--color-primary)] text-white px-6 py-2 rounded-lg font-medium hover:bg-[var(--color-primary-light)] transition-all shadow-md"
            >
              Login
            </Link>
          )}

          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-[var(--color-primary)] ml-2 text-sm"
            title="Admin Access"
          >
            🛠️
          </Link>
        </div>
      </div>
    </nav>
  );
}
