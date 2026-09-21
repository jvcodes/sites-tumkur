"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import Pagination from "../../components/Pagination";

interface VisitedSite {
    site_code: string;
    name?: string;
    location?: string;
    price?: number;
    area?: number;
    images?: string[];
    image?: string;
    visit_date: string;
    status?: string;
}

const PAGE_SIZE = 6;

export default function MyVisitsPage() {
    const { user, loading: authLoading } = useAuth();
    const [visits, setVisits] = useState<VisitedSite[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters & Pagination
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"recent" | "price_asc" | "price_desc" | "area">("recent");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (authLoading) return;
        const identifier = user?.email || user?.phone || "";
        if (identifier) {
            const queryParam = `user_id=${encodeURIComponent(identifier)}`;
            fetch(`/api/sites/visits/me?${queryParam}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setVisits(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else if (!authLoading) {
            setTimeout(() => setLoading(false), 0);
        }
    }, [user, authLoading]);

    // Filter & Sort
    const processedVisits = useMemo(() => {
        let result = visits.filter(site => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase().trim();
            return (
                site.name?.toLowerCase().includes(query) ||
                site.location?.toLowerCase().includes(query) ||
                site.site_code?.toLowerCase().includes(query)
            );
        });

        // Sorting
        result.sort((a, b) => {
            if (sortBy === "price_asc") {
                return (a.price || 0) - (b.price || 0);
            }
            if (sortBy === "price_desc") {
                return (b.price || 0) - (a.price || 0);
            }
            if (sortBy === "area") {
                return (b.area || 0) - (a.area || 0);
            }
            // "recent" (default)
            return new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime();
        });

        return result;
    }, [visits, searchQuery, sortBy]);

    // Reset pagination when search or sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortBy]);

    const totalPages = Math.ceil(processedVisits.length / PAGE_SIZE) || 1;
    const paginatedVisits = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return processedVisits.slice(start, start + PAGE_SIZE);
    }, [processedVisits, currentPage]);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 bg-gray-100 rounded w-1/4 animate-pulse"></div>
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-gray-50 border rounded-xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Title & Count Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Viewed Sites</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        History of Tumkur properties and layouts you have recently explored
                    </p>
                </div>
                <span className="self-start sm:self-auto bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200">
                    {visits.length} Properties Viewed
                </span>
            </div>

            {/* Filter & Sort Controls */}
            {visits.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    {/* Search box */}
                    <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Search viewed sites by location or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-gray-800"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                        <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Sort by:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium flex-1 sm:flex-initial"
                        >
                            <option value="recent">Recently Viewed</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                            <option value="area">Area: Largest First</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Zero state: No visits at all */}
            {visits.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mt-4">
                    <div className="text-5xl mb-3">👁️</div>
                    <h2 className="text-lg font-bold text-gray-800 mb-1">No Browsing History Yet</h2>
                    <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                        Check out listings on Tumkur's verified property feed. Properties you view will appear here for easy reference.
                    </p>
                    <Link
                        href="/"
                        className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow transition-colors text-sm"
                    >
                        Browse Properties
                    </Link>
                </div>
            ) : processedVisits.length === 0 ? (
                /* Zero state: No match for current search */
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-600 font-medium">No viewed properties match "{searchQuery}".</p>
                    <button
                        onClick={() => setSearchQuery("")}
                        className="mt-3 text-sm text-blue-600 font-bold hover:underline"
                    >
                        Clear search
                    </button>
                </div>
            ) : (
                /* Paginated Visits List */
                <div className="space-y-4">
                    {/* Showing X of Y count */}
                    <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                        <span>
                            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, processedVisits.length)} of {processedVisits.length} viewed properties
                        </span>
                        {totalPages > 1 && (
                            <span>Page {currentPage} of {totalPages}</span>
                        )}
                    </div>

                    <div className="grid gap-3.5">
                        {paginatedVisits.map((site, i) => (
                            <div
                                key={site.site_code || i}
                                className="flex flex-col md:flex-row gap-4 border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white md:items-center"
                            >
                                <div className="w-full md:w-36 h-44 md:h-24 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
                                    <img
                                        src={site.images?.[0] || site.image || "/no-image.svg"}
                                        className="w-full h-full object-cover"
                                        alt={site.name || "Tumkur Site"}
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-gray-900 text-base truncate">
                                                {site.name || "Real Estate Plot"}
                                            </h3>
                                            <p className="text-gray-500 text-xs truncate mt-0.5">
                                                📍 {site.location || "Tumkur"}
                                            </p>
                                        </div>
                                        <span className="bg-gray-100 border text-gray-600 text-[11px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                                            {site.site_code}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-3 text-xs">
                                        <div className="flex items-center gap-1.5 text-gray-500">
                                            <span>🕒 Viewed:</span>
                                            <span className="text-gray-800 font-semibold">
                                                {new Date(site.visit_date).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                            </span>
                                        </div>

                                        {site.area && (
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <span>📐 Area:</span>
                                                <span className="text-gray-800 font-semibold">{site.area} Sq.ft</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                site.status === "approved" || site.status === "active"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-amber-100 text-amber-700"
                                            }`}>
                                                {site.status || "APPROVED"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-2 pt-3 mt-2 border-t md:pt-0 md:mt-0 md:border-t-0 md:border-l md:pl-4">
                                    {site.price !== undefined && (
                                        <div className="text-left md:text-right">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold">Price</p>
                                            <p className="font-extrabold text-base sm:text-lg text-red-600">
                                                ₹{site.price.toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                    <Link
                                        href={`/site/${site.site_code}`}
                                        className="text-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs w-auto whitespace-nowrap"
                                    >
                                        View Details →
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Responsive Pagination Controls */}
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                </div>
            )}
        </div>
    );
}
