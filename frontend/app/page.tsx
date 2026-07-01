"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SiteCard from "./components/SiteCard";
import ClientOnly from "./components/ClientOnly";

export default function Home() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const LIMIT = 9;

  // Fetch distinct locations from DB for the dropdown
  useEffect(() => {
    fetch("/api/sites/locations/")
      .then((r) => r.json())
      .then((data) => {
        if (data.locations?.length) setLocations(data.locations);
      })
      .catch(() => {}); // silent — fallback to static list is not needed, DB is source of truth
  }, []);

  // Main fetch function
  const doFetch = useCallback(
    async (search: string, location: string, pageNum: number, append = false) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        let url: string;
        if (search || location) {
          url = `/api/sites/filter/?page=${pageNum}&limit=${LIMIT}`;
          if (search) url += `&search=${encodeURIComponent(search)}`;
          if (location) url += `&location=${encodeURIComponent(location)}`;
        } else {
          url = `/api/sites/?page=${pageNum}&limit=${LIMIT}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
        const tot: number = data.total ?? results.length;

        setSites((prev) => (append ? [...prev, ...results] : results));
        setTotal(tot);
        setHasMore(pageNum * LIMIT < tot);
      } catch (err) {
        console.error("Failed to fetch sites", err);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    []
  );

  // Initial load + debounced re-fetch when filters change
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => doFetch(searchTerm, locationFilter, 1, false), 400);
    return () => clearTimeout(t);
  }, [searchTerm, locationFilter, doFetch]);

  const handleSearch = () => {
    setSearchTerm(inputValue);
    setLocationFilter(locationInput);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    doFetch(searchTerm, locationFilter, next, true);
  };

  const handleClear = () => {
    setInputValue("");
    setLocationInput("");
    setSearchTerm("");
    setLocationFilter("");
  };

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* ── HERO ─────────────────────────────────── */}
      <section className="hidden md:block relative bg-[var(--color-primary)] text-white py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')]" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Find Your Perfect{" "}
            <span className="text-[var(--color-accent)]">Site</span> in Tumkur
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Discover verified residential plots, commercial lands — directly from owners.
          </p>

          {/* Search Bar */}
          <div className="flex flex-col md:flex-row gap-3 max-w-2xl mx-auto mt-8 p-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
            <ClientOnly fallback={<div className="flex-1 h-12 rounded-xl bg-white/50"></div>}>
              <input
                type="text"
                placeholder="Search by area, landmark, site code..."
                className="flex-1 px-6 py-3 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </ClientOnly>
            
            <ClientOnly fallback={<div className="h-12 w-32 rounded-xl bg-gray-50/50"></div>}>
              <select
                className="px-4 py-3 rounded-xl bg-gray-50 text-gray-800 border-l border-gray-200 focus:outline-none cursor-pointer"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </ClientOnly>
            <button
              onClick={handleSearch}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg transform hover:scale-105"
            >
              🔍 Search
            </button>
          </div>

          <p className="text-gray-400 text-sm mt-3">
            Have a plot to sell?{" "}
            <a href="/upload-site" className="text-[var(--color-accent)] font-semibold hover:underline">
              List it free →
            </a>
          </p>
        </div>
      </section>

      {/* ── UPLOAD CTA BANNER ─────────────────────── */}
      <div className="hidden md:block bg-gradient-to-r from-[var(--color-primary)] to-[#1e40af] text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏡</span>
            <div>
              <span className="font-semibold text-sm">Own a site or plot?</span>
              <span className="text-gray-300 text-sm ml-2 hidden sm:inline">
                Get it in front of thousands of buyers — it&apos;s free.
              </span>
            </div>
          </div>
          <a
            href="/upload-site"
            className="shrink-0 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-sm py-1.5 px-5 rounded-lg transition-all shadow-md hover:scale-105 transform"
          >
            + Upload Your Site
          </a>
        </div>
      </div>

      {/* ── LISTINGS ──────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-0 md:px-6 py-4 md:py-12 bg-gray-50 md:bg-transparent min-h-screen">
        <div className="flex justify-between items-center mb-4 md:mb-8 px-4 md:px-0">
          <h2 className="text-xl md:text-2xl font-bold text-[var(--color-primary)]">
            {searchTerm || locationFilter ? "Search Results" : "Latest Listings"}
          </h2>
          <div className="flex items-center gap-3">
            {(searchTerm || locationFilter) && (
              <button
                onClick={handleClear}
                className="text-sm text-red-500 font-medium hover:underline"
              >
                ✕ Clear Filter
              </button>
            )}
            {!loading && (
              <span className="text-gray-500 text-sm">
                {sites.length} of {total} sites
              </span>
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 bg-gray-50 md:bg-transparent">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && sites.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-500 text-lg">No sites found matching your search.</p>
            <button
              onClick={handleClear}
              className="mt-4 text-[var(--color-accent)] font-medium hover:underline"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Sites Grid */}
        {!loading && sites.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 md:gap-8 bg-gray-100 md:bg-transparent">
              {sites.map((site) => (
                <SiteCard key={site.id || site.site_code} site={site} />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="flex flex-col items-center mt-12 gap-2">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white font-bold py-3 px-10 rounded-xl transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    `Load More Sites ↓`
                  )}
                </button>
                <p className="text-gray-400 text-sm">
                  Showing {sites.length} of {total} sites
                </p>
              </div>
            )}

            {/* All loaded indicator */}
            {!hasMore && sites.length > LIMIT && (
              <p className="text-center text-gray-400 text-sm mt-10">
                ✅ All {total} sites loaded
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
