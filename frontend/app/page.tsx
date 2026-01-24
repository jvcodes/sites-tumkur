"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteCard from "./components/SiteCard";
import SiteCardSkeleton from "./components/SiteCardSkeleton";

interface Site {
  site_code: string;
  name: string;
  location: string;
  price: number;
  image?: string;
}

export default function Home() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q");

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔍 filters
  const [location, setLocation] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("");

  // 📄 pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 9;

  // 🔹 Load data when page or search changes
  useEffect(() => {
    if (searchQuery) {
      applySearch(searchQuery);
    } else {
      fetchAllSites();
    }
  }, [searchQuery, page]);

  // 🔹 Fetch paginated approved sites
  const fetchAllSites = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `http://127.0.0.1:8000/api/sites/?page=${page}&limit=${limit}`
      );

      const data = await res.json();

      setSites(data.results || []);
      setTotal(data.total || 0);
      setError("");
    } catch {
      setError("Failed to fetch sites");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Apply sidebar filters (resets page)
  const applyFilters = async () => {
    try {
      setLoading(true);
      setPage(1);

      let url =
        "http://127.0.0.1:8000/api/sites/filter/?";

      if (location) {
        url += `location=${encodeURIComponent(location)}&`;
      }

      if (maxPrice) {
        url += `max_price=${maxPrice}&`;
      }

      if (sort) {
        url += `sort=${sort}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      setSites(data);
      setTotal(data.length);
      setError("");
    } catch {
      setError("Failed to apply filters");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Search (site_code OR location)
  const applySearch = async (query: string) => {
    try {
      setLoading(true);
      setPage(1);

      const isSiteCode = /\d/.test(query);

      let url =
        "http://127.0.0.1:8000/api/sites/filter/?";

      if (isSiteCode) {
        url += `site_code=${encodeURIComponent(query)}`;
      } else {
        url += `location=${encodeURIComponent(query)}`;
      }

      if (sort) {
        url += `&sort=${sort}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      setSites(data);
      setTotal(data.length);
      setError("");
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">
          Approved Sites
        </h1>

        {error && (
          <p className="text-red-500 mb-4">{error}</p>
        )}

        <div className="flex gap-6">
          {/* FILTER SIDEBAR */}
          <div className="w-1/4 bg-white rounded-lg shadow p-4 h-fit">
            <h2 className="font-semibold text-lg mb-4">
              Filters
            </h2>

            <label className="block text-sm mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) =>
                setLocation(e.target.value)
              }
              placeholder="Enter city"
              className="w-full border rounded px-3 py-2 mb-4"
            />

            <label className="block text-sm mb-1">
              Max Price
            </label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) =>
                setMaxPrice(e.target.value)
              }
              placeholder="₹ Max"
              className="w-full border rounded px-3 py-2 mb-4"
            />

            <label className="block text-sm mb-1">
              Sort by Price
            </label>
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value)
              }
              className="w-full border rounded px-3 py-2 mb-4"
            >
              <option value="">Default</option>
              <option value="price_low">
                Low to High
              </option>
              <option value="price_high">
                High to Low
              </option>
            </select>

            <button
              onClick={applyFilters}
              className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
            >
              Apply Filters
            </button>

            <button
              onClick={() => {
                setPage(1);
                fetchAllSites();
              }}
              className="w-full mt-2 border border-red-600 text-red-600 py-2 rounded hover:bg-red-50"
            >
              Reset
            </button>
          </div>

          {/* RESULTS */}
          <div className="w-3/4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <SiteCardSkeleton key={i} />
                ))}

              {!loading && sites.length === 0 && (
                <p className="text-gray-500">
                  No sites found.
                </p>
              )}

              {!loading &&
                sites.map((site) => (
                  <SiteCard
                    key={site.site_code}
                    name={site.name}
                    location={site.location}
                    price={site.price}
                    code={site.site_code}
                    image={site.image}
                  />
                ))}
            </div>

            {/* PAGINATION */}
            {!loading && total > limit && (
              <div className="flex justify-center gap-4 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Prev
                </button>

                <span className="px-4 py-2">
                  Page {page}
                </span>

                <button
                  disabled={page * limit >= total}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
