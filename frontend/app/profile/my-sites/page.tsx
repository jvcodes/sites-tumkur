"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi, ApiError } from "../../../lib/api-client";
import Pagination from "../../components/Pagination";

interface Site {
    site_code: string;
    name: string;
    location: string;
    area: number;
    price: number;
    status: string;
}

type TabType = "all" | "approved" | "pending" | "sold";
const PAGE_SIZE = 5;

export default function MySitesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Filters & Pagination
    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const { data: sites = [], isLoading, error } = useQuery<Site[], ApiError>({
        queryKey: ["my-sites", user?.email, user?.phone, user?.name],
        queryFn: async () => {
            if (!user) return [];
            
            const params = new URLSearchParams();
            if (user.email) {
                params.append("user_id", user.email);
            } else if (user.phone) {
                params.append("user_id", user.phone);
            }
            if (user.name) {
                params.append("owner", user.name);
            }
            
            return fetchApi<Site[]>(`/api/sites/my-sites?${params.toString()}`);
        },
        enabled: !!user,
    });

    const deleteMutation = useMutation({
        mutationFn: async (siteCode: string) => {
            const userId = user?.email || user?.phone || "";
            return fetchApi(`/api/sites/delete-by-code/${siteCode}`, {
                method: "DELETE",
                body: JSON.stringify({ user_id: userId })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["my-sites"] });
            toast.success("Site deleted successfully!");
        },
        onError: () => {
            toast.error("Could not delete site. Please check permissions and try again.");
        }
    });

    const handleDelete = async (siteCode: string) => {
        if (!confirm(`Are you sure you want to delete site ${siteCode}? This cannot be undone.`)) {
            return;
        }
        deleteMutation.mutate(siteCode);
    };

    // Tab counts
    const counts = useMemo(() => {
        const total = sites.length;
        const approved = sites.filter(s => (s.status || "").toLowerCase() === "approved").length;
        const pending = sites.filter(s => (s.status || "").toLowerCase() === "pending").length;
        const sold = sites.filter(s => (s.status || "").toLowerCase() === "sold").length;
        return { total, approved, pending, sold };
    }, [sites]);

    // Filtered sites
    const filteredSites = useMemo(() => {
        return sites.filter(site => {
            const status = (site.status || "pending").toLowerCase();
            if (activeTab === "approved" && status !== "approved") return false;
            if (activeTab === "pending" && status !== "pending") return false;
            if (activeTab === "sold" && status !== "sold") return false;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase().trim();
                const matches =
                    site.site_code?.toLowerCase().includes(query) ||
                    site.name?.toLowerCase().includes(query) ||
                    site.location?.toLowerCase().includes(query);
                if (!matches) return false;
            }

            return true;
        });
    }, [sites, activeTab, searchQuery]);

    // Reset pagination on tab/search change
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    const totalPages = Math.ceil(filteredSites.length / PAGE_SIZE) || 1;
    const paginatedSites = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredSites.slice(start, start + PAGE_SIZE);
    }, [filteredSites, currentPage]);

    if (!user) {
        return (
            <div className="text-center mt-20 flex flex-col items-center">
                <p className="text-xl text-gray-600 mb-6">Please log in to view your profile.</p>
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-white bg-blue-600 hover:bg-blue-700 font-semibold px-6 py-3 rounded-lg shadow-sm transition-colors"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">My Uploaded Sites</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Manage your property listings in Tumkur, track approval statuses, or edit details
                    </p>
                </div>
                <button
                    onClick={() => router.push("/upload-site")}
                    className="self-start sm:self-auto bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
                >
                    <span>+</span> Upload New Site
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    <div className="h-8 bg-gray-100 rounded w-1/4 animate-pulse"></div>
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse"></div>
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-50 border rounded-lg animate-pulse"></div>
                        ))}
                    </div>
                </div>
            ) : error ? (
                <div className="text-center py-10">
                    <p className="text-red-500 mb-6">{error.message}</p>
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center text-white bg-blue-600 hover:bg-blue-700 font-semibold px-6 py-2 rounded-lg shadow-sm transition-colors"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Go Back
                    </button>
                </div>
            ) : sites.length === 0 ? (
                <div className="bg-gray-50 border border-dashed rounded-2xl p-12 text-center">
                    <div className="text-5xl mb-3">🏠</div>
                    <h2 className="text-lg font-bold text-gray-800 mb-1">You haven't uploaded any sites yet.</h2>
                    <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                        List your property in Tumkur to reach verified buyers and get genuine site visit requests.
                    </p>
                    <button
                        onClick={() => router.push("/upload-site")}
                        className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold shadow hover:bg-red-700 text-sm transition"
                    >
                        Upload a Site
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Status Tabs and Search */}
                    <div className="space-y-3">
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
                                onClick={() => setActiveTab("approved")}
                                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                    activeTab === "approved"
                                        ? "bg-green-600 text-white shadow-sm"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                                Approved
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    activeTab === "approved" ? "bg-green-700 text-white" : "bg-gray-200 text-gray-700"
                                }`}>
                                    {counts.approved}
                                </span>
                            </button>

                            <button
                                onClick={() => setActiveTab("pending")}
                                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                    activeTab === "pending"
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                                Pending
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    activeTab === "pending" ? "bg-amber-700 text-white" : "bg-gray-200 text-gray-700"
                                }`}>
                                    {counts.pending}
                                </span>
                            </button>

                            <button
                                onClick={() => setActiveTab("sold")}
                                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                                    activeTab === "sold"
                                        ? "bg-red-600 text-white shadow-sm"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                                Sold
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    activeTab === "sold" ? "bg-red-700 text-white" : "bg-gray-200 text-gray-700"
                                }`}>
                                    {counts.sold}
                                </span>
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                                🔍
                            </span>
                            <input
                                type="text"
                                placeholder="Search by Site ID, title, or location..."
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

                    {filteredSites.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-gray-600 font-medium">No uploaded sites match your filter.</p>
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
                        <div>
                            {/* Showing counter */}
                            <div className="flex justify-between items-center text-xs text-gray-500 px-1 mb-3">
                                <span>
                                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredSites.length)} of {filteredSites.length} properties
                                </span>
                                {totalPages > 1 && (
                                    <span>Page {currentPage} of {totalPages}</span>
                                )}
                            </div>

                            {/* Responsive Table View */}
                            <div className="overflow-x-auto shadow-xs border border-gray-200 rounded-xl bg-white">
                                <table className="w-full text-left bg-white border-collapse min-w-[640px]">
                                    <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-bold border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3.5">Site ID</th>
                                            <th className="px-6 py-3.5">Location</th>
                                            <th className="px-6 py-3.5">Size</th>
                                            <th className="px-6 py-3.5">Price</th>
                                            <th className="px-6 py-3.5">Status</th>
                                            <th className="px-6 py-3.5 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-600 text-sm divide-y divide-gray-100">
                                        {paginatedSites.map((site) => (
                                            <tr key={site.site_code} className="hover:bg-gray-50/70 transition-colors">
                                                <td className="px-6 py-4 font-mono font-bold text-gray-900">{site.site_code}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-gray-800">{site.name}</div>
                                                    <div className="text-xs text-gray-500">{site.location}</div>
                                                </td>
                                                <td className="px-6 py-4">{site.area ? `${site.area} Sq.ft` : "N/A"}</td>
                                                <td className="px-6 py-4 font-bold text-red-600">₹{site.price?.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                                                        site.status === "approved" ? "bg-green-100 text-green-700" :
                                                        site.status === "pending" ? "bg-amber-100 text-amber-700" :
                                                        site.status === "sold" ? "bg-red-100 text-red-700" :
                                                        "bg-gray-100 text-gray-700"
                                                    }`}>
                                                        {site.status.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2 justify-center">
                                                        <button
                                                            onClick={() => router.push(`/site/${site.site_code}`)}
                                                            className="text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-md font-bold transition"
                                                        >
                                                            View
                                                        </button>
                                                        <button
                                                            onClick={() => router.push(`/site/${site.site_code}/edit`)}
                                                            className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md font-bold transition"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(site.site_code)}
                                                            className="text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 px-2.5 py-1.5 rounded-md font-bold transition"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
            )}
        </div>
    );
}
