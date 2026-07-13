"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

interface Site {
    site_code: string;
    name: string;
    location: string;
    area: number;
    price: number;
    status: string;
}

export default function MySitesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [sites, setSites] = useState<Site[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // If not logged in, wait or redirect (useAuth can be slow if it checks local storage)
        if (user === null) {
            // Optional: you could redirect to login here if you prefer
            // router.push("/login");
            return;
        }

        const fetchMySites = async () => {
            try {
                setLoading(true);
                // Assuming your backend uses user.name as the owner matching field
                const params = new URLSearchParams();
                if (user.email) params.append("user_id", user.email);
                if (user.name)  params.append("owner", user.name);
                const res = await fetch(
                    `/api/sites/my-sites?${params.toString()}`
                );

                if (!res.ok) throw new Error("Failed to fetch your sites");

                const data = await res.json();
                setSites(data);
            } catch (err) {
                setError("Error loading sites.");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchMySites();
        }
    }, [user]);

    const handleDelete = async (siteCode: string) => {
        if (!confirm(`Are you sure you want to delete site ${siteCode}? This cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/sites/delete-by-code/${siteCode}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Failed to delete site");

            // Remove from UI
            setSites((prev) => prev.filter((s) => s.site_code !== siteCode));
            toast.success("Site deleted successfully!");
        } catch (err) {
            toast.error("Could not delete site. Please try again.");
        }
    };

    if (!user) {
        return <div className="text-center mt-20 text-xl text-gray-600">Please log in to view your profile.</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">My Uploaded Sites</h1>

            {loading ? (
                <p className="text-gray-500">Loading your sites...</p>
            ) : error ? (
                <p className="text-red-500">{error}</p>
            ) : sites.length === 0 ? (
                <div className="bg-gray-50 border rounded-lg p-10 text-center">
                    <p className="text-gray-600 mb-4">You haven't uploaded any sites yet.</p>
                    <button
                        onClick={() => router.push("/upload-site")}
                        className="bg-red-600 text-white px-6 py-2 rounded shadow hover:bg-red-700"
                    >
                        Upload a Site
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
                    <table className="w-full text-left bg-white border-collapse">
                        <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Site ID</th>
                                <th className="px-6 py-4 font-semibold">Location</th>
                                <th className="px-6 py-4 font-semibold">Size</th>
                                <th className="px-6 py-4 font-semibold">Price</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-600 text-sm">
                            {sites.map((site) => (
                                <tr key={site.site_code} className="border-t hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900">{site.site_code}</td>
                                    <td className="px-6 py-4">{site.location}</td>
                                    <td className="px-6 py-4">{site.area ? `${site.area} Sq.ft` : "N/A"}</td>
                                    <td className="px-6 py-4">₹{site.price.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${site.status === "approved" ? "bg-green-100 text-green-700" :
                                            site.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                                                site.status === "sold" ? "bg-red-100 text-red-700" :
                                                    "bg-gray-100 text-gray-700"
                                            }`}>
                                            {site.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex gap-3 justify-center">
                                        <button
                                            onClick={() => router.push(`/site/${site.site_code}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => router.push(`/site/${site.site_code}/edit`)}
                                            className="text-green-600 hover:text-green-800 font-medium"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(site.site_code)}
                                            className="text-red-600 hover:text-red-800 font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
