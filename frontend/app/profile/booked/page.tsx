"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";
import Pagination from "../../components/Pagination";

interface SiteItem {
    site_code: string;
    name: string;
    location: string;
    price?: number;
    images?: string[];
    image?: string;
}

interface Booking {
    id: string;
    date: string;
    time?: string;
    created_at: string;
    status?: string;
    broker_name?: string;
    sites?: SiteItem[];
}

type TabType = "all" | "active" | "completed" | "rejected";

const PAGE_SIZE = 5;

export default function BookedVisitsPage() {
    const { user, loading: authLoading } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter & Pagination States
    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (authLoading) return;
        const identifier = user?.email || user?.phone || "";
        if (identifier) {
            const queryParam = `user_id=${encodeURIComponent(identifier)}`;
            fetch(`/api/bookings/me?${queryParam}`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setBookings(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [user, authLoading]);

    // Counts for tabs
    const counts = useMemo(() => {
        const total = bookings.length;
        const active = bookings.filter(b => {
            const s = (b.status || "pending").toLowerCase();
            return s === "pending" || s === "approved";
        }).length;
        const completed = bookings.filter(b => (b.status || "").toLowerCase() === "completed").length;
        const rejected = bookings.filter(b => {
            const s = (b.status || "").toLowerCase();
            return s === "rejected" || s === "cancelled";
        }).length;
        return { total, active, completed, rejected };
    }, [bookings]);

    // Filtered bookings
    const filteredBookings = useMemo(() => {
        return bookings.filter(booking => {
            const status = (booking.status || "pending").toLowerCase();

            // Tab Filter
            if (activeTab === "active" && status !== "pending" && status !== "approved") return false;
            if (activeTab === "completed" && status !== "completed") return false;
            if (activeTab === "rejected" && status !== "rejected" && status !== "cancelled") return false;

            // Search Query Filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const matchesBroker = booking.broker_name?.toLowerCase().includes(query);
                const matchesSites = booking.sites?.some(s =>
                    s.name?.toLowerCase().includes(query) ||
                    s.location?.toLowerCase().includes(query) ||
                    s.site_code?.toLowerCase().includes(query)
                );
                if (!matchesBroker && !matchesSites) return false;
            }

            return true;
        });
    }, [bookings, activeTab, searchQuery]);

    // Reset pagination when tab or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredBookings.length / PAGE_SIZE) || 1;
    const paginatedBookings = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredBookings.slice(start, start + PAGE_SIZE);
    }, [filteredBookings, currentPage]);

    const toggleExpand = (id: string) => {
        setExpandedBookings(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 bg-gray-100 rounded w-1/4 animate-pulse"></div>
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-44 bg-gray-50 border rounded-xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Title and Overall Count */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Booked for Visit</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Track, manage, and review all your scheduled on-site Tumkur visits
                    </p>
                </div>
                <span className="self-start sm:self-auto bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200">
                    {bookings.length} Total Bookings
                </span>
            </div>

            {/* Filter Tabs & Search Bar */}
            {bookings.length > 0 && (
                <div className="space-y-3">
                    {/* Status Tabs */}
                    <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                activeTab === "all"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            All
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                activeTab === "all" ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"
                            }`}>
                                {counts.total}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("active")}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                activeTab === "active"
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Upcoming & Pending
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                activeTab === "active" ? "bg-amber-700 text-white" : "bg-gray-200 text-gray-700"
                            }`}>
                                {counts.active}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("completed")}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                activeTab === "completed"
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Completed
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                activeTab === "completed" ? "bg-green-700 text-white" : "bg-gray-200 text-gray-700"
                            }`}>
                                {counts.completed}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab("rejected")}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                activeTab === "rejected"
                                    ? "bg-red-600 text-white shadow-sm"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            Cancelled / Rejected
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                activeTab === "rejected" ? "bg-red-700 text-white" : "bg-gray-200 text-gray-700"
                            }`}>
                                {counts.rejected}
                            </span>
                        </button>
                    </div>

                    {/* Search Input for fast lookup */}
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Filter bookings by location, site code, or agent..."
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
                </div>
            )}

            {/* Zero state: No bookings at all */}
            {bookings.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mt-6">
                    <div className="text-5xl mb-3">📅</div>
                    <h2 className="text-lg font-bold text-gray-800 mb-1">No Site Visits Booked Yet</h2>
                    <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                        Find verified plots in Tumkur and schedule a free guided visit with our local agents.
                    </p>
                    <Link
                        href="/"
                        className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow transition-colors text-sm"
                    >
                        Explore Properties
                    </Link>
                </div>
            ) : filteredBookings.length === 0 ? (
                /* Zero state: No match for current filter/search */
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-600 font-medium">No bookings match your current filter.</p>
                    <button
                        onClick={() => {
                            setActiveTab("all");
                            setSearchQuery("");
                        }}
                        className="mt-3 text-sm text-blue-600 font-bold hover:underline"
                    >
                        Reset filters
                    </button>
                </div>
            ) : (
                /* Paginated Bookings List */
                <div className="space-y-4">
                    {/* Showing X of Y count */}
                    <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                        <span>
                            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length} bookings
                        </span>
                        {totalPages > 1 && (
                            <span>Page {currentPage} of {totalPages}</span>
                        )}
                    </div>

                    {paginatedBookings.map((booking, index) => {
                        const bookingKey = booking.id || `booking-${index}`;
                        const sites = booking.sites || [];
                        const isExpanded = expandedBookings[bookingKey] || false;
                        const visibleSites = isExpanded ? sites : sites.slice(0, 2);
                        const hiddenCount = sites.length - visibleSites.length;

                        const rawStatus = (booking.status || "pending").toLowerCase();
                        const statusBadge =
                            rawStatus === "approved"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : rawStatus === "completed"
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : rawStatus === "rejected" || rawStatus === "cancelled"
                                ? "bg-red-100 text-red-700 border-red-200"
                                : "bg-amber-100 text-amber-800 border-amber-200";

                        const statusLabel =
                            rawStatus === "approved"
                                ? "Visit Confirmed"
                                : rawStatus === "completed"
                                ? "Visit Completed"
                                : rawStatus === "rejected" || rawStatus === "cancelled"
                                ? "Cancelled"
                                : "Pending Confirmation";

                        return (
                            <div
                                key={bookingKey}
                                className="bg-white border border-gray-200 rounded-xl shadow-xs hover:shadow-md transition-shadow p-5"
                            >
                                {/* Booking Header & Status */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📅</span>
                                            <h2 className="text-base sm:text-lg font-bold text-gray-800">
                                                {new Date(booking.date).toLocaleDateString("en-IN", {
                                                    weekday: "short",
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                                {booking.time && (
                                                    <span className="text-blue-600 font-bold ml-2">
                                                        @ {booking.time}
                                                    </span>
                                                )}
                                            </h2>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Booked on {new Date(booking.created_at).toLocaleDateString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric"
                                            })}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${statusBadge}`}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                </div>

                                {/* Assigned Broker Badge if present */}
                                {booking.broker_name && (
                                    <div className="mb-4 p-3 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-800 font-bold flex items-center justify-center text-xs">
                                                {booking.broker_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-blue-900">
                                                    Assigned Agent: {booking.broker_name}
                                                </p>
                                                <p className="text-[11px] text-blue-600">
                                                    Local Tumkur representative will coordinate your visit
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Sites in this Booking */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                                            Properties Included ({sites.length})
                                        </h3>
                                        {sites.length > 2 && (
                                            <button
                                                onClick={() => toggleExpand(bookingKey)}
                                                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                {isExpanded ? "Show Less ▴" : `+ Show All ${sites.length} Sites ▾`}
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid gap-2.5">
                                        {visibleSites.map((site, siteIdx) => (
                                            <div
                                                key={siteIdx}
                                                className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center bg-gray-50/80 p-3 rounded-lg border border-gray-100 hover:border-gray-300 transition-colors"
                                            >
                                                <div className="w-full sm:w-20 h-24 sm:h-16 bg-gray-200 rounded overflow-hidden shrink-0">
                                                    <img
                                                        src={site.images?.[0] || site.image || "/no-image.svg"}
                                                        alt={site.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-gray-800 text-sm truncate">
                                                            {site.name}
                                                        </h4>
                                                        <span className="text-[10px] font-mono bg-white border px-1.5 py-0.5 rounded text-gray-600 shrink-0">
                                                            {site.site_code}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                                        📍 {site.location}
                                                    </p>
                                                </div>

                                                <div className="flex justify-between items-center w-full sm:w-auto sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-gray-200">
                                                    {site.price !== undefined && (
                                                        <div className="text-left sm:text-right">
                                                            <p className="text-[10px] text-gray-400 uppercase font-semibold">Price</p>
                                                            <p className="font-extrabold text-sm text-red-600">
                                                                ₹{site.price.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <Link
                                                        href={`/site/${site.site_code}`}
                                                        className="text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-300 px-3 py-1.5 rounded-lg transition-colors bg-white shrink-0"
                                                    >
                                                        View Details
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}

                                        {!isExpanded && hiddenCount > 0 && (
                                            <button
                                                onClick={() => toggleExpand(bookingKey)}
                                                className="w-full py-2 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-600 border border-dashed rounded-lg transition"
                                            >
                                                + {hiddenCount} more {hiddenCount === 1 ? "site" : "sites"} in this booking. Click to expand.
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

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
