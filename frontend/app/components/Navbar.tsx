"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ClientOnly from "./ClientOnly";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";

export default function Navbar() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { user, logout } = useAuth();
  const { wishlist } = useWishlist();
  const [visitListCount, setVisitListCount] = useState(0);

  // Update visit list count periodically to reflect changes from other components
  useEffect(() => {
    const updateCount = () => {
      const raw = JSON.parse(localStorage.getItem("cart") || "[]");
      setVisitListCount(raw.length);
    };

    updateCount(); // Initial load

    // Listen for storage changes (works across tabs)
    window.addEventListener("storage", updateCount);

    // Polling as a fallback for same-tab changes since localStorage doesn't trigger 'storage' event in the same tab easily without custom events
    const intervalId = setInterval(updateCount, 1000);

    return () => {
      window.removeEventListener("storage", updateCount);
      clearInterval(intervalId);
    };
  }, []);

  // 🔍 Trigger search on Enter
  const handleSearch = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" && search.trim()) {
      router.push(`/?q=${encodeURIComponent(search)}`);
    }
  };

  return (
    <>
      {/* ── TOP NAVBAR ────────────────────────────────────────────── */}
      <nav className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          
          {/* LOGO */}
          <Link
            href="/"
            className="text-2xl font-bold text-[var(--color-primary)] tracking-wide"
          >
            SiteHub
          </Link>

          {/* DESKTOP SEARCH */}
          <div className="flex-1 mx-6 hidden md:block">
            <ClientOnly fallback={<div className="w-full h-10 border border-gray-300 rounded-full bg-gray-50"></div>}>
              <input
                type="text"
                placeholder="Search locations or site_code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full border border-gray-300 rounded-full px-4 py-2
                           focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] bg-gray-50"
              />
            </ClientOnly>
          </div>

          {/* MOBILE SEARCH / FILTER ICON */}
          <div className="flex md:hidden items-center gap-4">
            <button className="text-gray-600 p-2 bg-gray-50 rounded-full border border-gray-100">
              🔍
            </button>
          </div>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/wishlist"
              className="relative text-gray-700 hover:text-[var(--color-accent)] transition-colors flex items-center"
            >
              ❤️ Wishlist
              {wishlist.length > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-white">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <Link
              href="/cart"
              className="relative text-gray-700 hover:text-[var(--color-accent)] transition-colors flex items-center"
            >
              📋 Visit List
              {visitListCount > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center border border-white">
                  {visitListCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative group">
                <button className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="flex-col items-start hidden sm:flex">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Profile</span>
                    <span className="text-sm font-bold text-gray-800 line-clamp-1 max-w-[100px]">{user.name}</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {/* DROPDOWN MENU */}
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right scale-95 group-hover:scale-100">
                  <div className="p-2 space-y-1">
                    <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition-colors">
                      <span className="opacity-80">👤</span> My Profile
                    </Link>
                    <Link href="/profile/visits" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition-colors">
                      <span className="opacity-80">👁️</span> My Visits
                    </Link>
                    <Link href="/profile/booked" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition-colors">
                      <span className="opacity-80">📅</span> Booked for Visit
                    </Link>
                    <Link href="/profile/my-sites" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition-colors">
                      <span className="opacity-80">🏠</span> My Uploaded Sites
                    </Link>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors">
                      <span className="opacity-80">🚪</span> Logout
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                className="bg-[var(--color-primary)] text-white px-4 md:px-6 py-2 rounded-lg font-medium hover:bg-[var(--color-primary-light)] transition-all shadow-md text-sm md:text-base"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around py-3 pb-safe z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <Link href="/" className="flex flex-col items-center gap-1 text-gray-600 hover:text-[var(--color-accent)]">
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">Home</span>
        </Link>
        <Link href="/wishlist" className="relative flex flex-col items-center gap-1 text-gray-600 hover:text-[var(--color-accent)]">
          <span className="text-xl">❤️</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">Saved</span>
          {wishlist.length > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white">
              {wishlist.length}
            </span>
          )}
        </Link>
        <Link href="/upload-site" className="flex flex-col items-center gap-1 -mt-5 relative z-10">
          <div className="w-12 h-12 bg-[var(--color-accent)] rounded-full flex items-center justify-center shadow-lg border-4 border-white text-white text-2xl font-light hover:bg-[var(--color-accent-hover)] transition-colors">
            +
          </div>
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mt-1">Upload</span>
        </Link>
        <Link href="/cart" className="relative flex flex-col items-center gap-1 text-gray-600 hover:text-[var(--color-accent)]">
          <span className="text-xl">📋</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">Visits</span>
          {visitListCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white">
              {visitListCount}
            </span>
          )}
        </Link>
        <Link href={user ? "/profile" : "/login"} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[var(--color-accent)]">
          <span className="text-xl">👤</span>
          <span className="text-[10px] font-bold uppercase tracking-wide">Profile</span>
        </Link>
      </nav>
    </>
  );
}
