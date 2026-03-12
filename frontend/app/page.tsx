"use client";

import { useState, useEffect } from "react";
import SiteCard from "./components/SiteCard";

export default function Home() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  // Initial Fetch & Search
  useEffect(() => {
    const fetchSites = async () => {
      setLoading(true);
      try {
        let url = `/api/sites/?`;

        // Switch to filter endpoint if we have filters
        if (searchTerm || locationFilter) {
          url = `/api/sites/filter/?`;
          if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
          if (locationFilter) url += `&location=${encodeURIComponent(locationFilter)}`;
        }

        console.log("Fetching URL:", url); // DEBUG
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Server status: ${res.status}`);
        }

        const data = await res.json();
        console.log("API Response Data:", data); // DEBUG

        // Handle new paginated response structure { results: [], total: 0 }
        if (data.results) {
          setSites(data.results);
        } else if (Array.isArray(data)) {
          setSites(data);
        } else {
          setSites([]);
        }
      } catch (error) {
        console.error("Failed to fetch sites", error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce slightly to prevent spam
    const timeoutId = setTimeout(() => {
      fetchSites();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, locationFilter]);

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* ---------------- HERO SECTION ---------------- */}
      <section className="relative bg-[var(--color-primary)] text-white py-24 px-6 overflow-hidden">
        {/* Background Pattern (Optional) */}
        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')]"></div>

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Find Your Perfect <span className="text-[var(--color-accent)]">Site</span> in Tumkur
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Discover premium residential plots, commercial lands, and agricultural sites verified for you.
          </p>

          {/* Search Bar */}
          <div className="flex flex-col md:flex-row gap-3 max-w-2xl mx-auto mt-8 p-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
            <input
              type="text"
              placeholder="Search by landmark, area..."
              className="flex-1 px-6 py-3 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="px-6 py-3 rounded-xl bg-gray-50 text-gray-800 border-l border-gray-200 focus:outline-none cursor-pointer"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="">All Locations</option>
              <option value="Tumkur">Tumkur</option>
              <option value="Gubbi">Gubbi</option>
              <option value="Kunigal">Kunigal</option>
              <option value="Sira">Sira</option>
              <option value="Tiptur">Tiptur</option>
            </select>
            <button className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg transform hover:scale-105">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- CONTENT SECTION ---------------- */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-primary)]">
            Latest Listings
          </h2>
          <span className="text-gray-500 text-sm">Showing {sites.length} sites</span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 ">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 bg-gray-100 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && sites.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-lg">No sites found matching your criteria.</p>
            <button
              onClick={() => { setSearchTerm(''); setLocationFilter(''); }}
              className="mt-4 text-[var(--color-accent)] font-medium hover:underline"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {sites.map((site) => (
            <SiteCard key={site._id || site.id_str} site={site} />
          ))}
        </div>
      </div>
    </main>
  );
}
