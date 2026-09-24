"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";

interface Site {
    site_code: string;
    name: string;
    location: string;
    price: number;
    area?: number;
    owner?: string;
    user_id?: string;
    description?: string;
    dimension?: string;
    facing?: string;
    corner_site?: boolean;
    status?: string;
}

export default function EditSitePage() {
    const params = useParams();
    const router = useRouter();
    const siteCode = params.site_code as string;

    const [form, setForm] = useState({
        name: "",
        location: "",
        price: "",
        owner: "",
        area: "",
        dimension: "",
        facing: "",
        corner_site: false,
        status: "approved",
        description: "",
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const { user } = useAuth();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const fetchSite = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/sites/${siteCode}`);

                if (!res.ok) {
                    throw new Error("Site not found");
                }

                const data: Site = await res.json();

                // Robust authorization check by user_id, email, phone, or owner name
                const isOwner = Boolean(
                    user && (
                        (data.user_id && (
                            (user.email && user.email.toLowerCase() === data.user_id.toLowerCase()) ||
                            (user.phone && user.phone.includes(data.user_id)) ||
                            (data.user_id.includes(user.phone || "___"))
                        )) ||
                        (data.owner && user.name && user.name.toLowerCase() === data.owner.toLowerCase()) ||
                        user.role === "admin"
                    )
                );

                if (!isOwner) {
                    setError("You are not authorized to edit this site.");
                    setAuthorized(false);
                    setLoading(false);
                    return;
                }

                setAuthorized(true);

                setForm({
                    name: data.name || "",
                    location: data.location || "",
                    price: data.price?.toString() || "",
                    owner: data.owner || "",
                    area: data.area?.toString() || "",
                    dimension: data.dimension || "",
                    facing: data.facing || "",
                    corner_site: Boolean(data.corner_site),
                    status: data.status || "approved",
                    description: data.description || "",
                });
            } catch {
                setError("Failed to load site details");
            } finally {
                setLoading(false);
            }
        };

        if (user !== undefined) {
            fetchSite();
        }
    }, [siteCode, user]);

    const handleChange = (e: any) => {
        const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setForm({ ...form, [e.target.name]: value });
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        const updateData: any = {
            name: form.name,
            location: form.location,
            price: Number(form.price),
            owner: form.owner,
            area: form.area ? Number(form.area) : null,
            dimension: form.dimension || null,
            facing: form.facing || null,
            corner_site: Boolean(form.corner_site),
            description: form.description,
        };
        if (form.status) {
            updateData.status = form.status;
        }

        try {
            const res = await fetch(
                `/api/sites/update-by-code/${siteCode}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (!res.ok) throw new Error("Update failed");

            setMessage("✅ Site updated successfully!");
            setTimeout(() => {
                router.push(`/site/${siteCode}`);
            }, 1500);
        } catch {
            setMessage("❌ Failed to update site");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-center mt-10">Loading site details...</p>;
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                <p className="text-red-600 text-center text-xl font-bold mb-4">{error}</p>
                <button
                    onClick={() => router.push(`/site/${siteCode}`)}
                    className="bg-gray-200 text-gray-800 px-6 py-2 rounded shadow hover:bg-gray-300"
                >
                    Return to Site
                </button>
            </div>
        );
    }

    if (!authorized) return null;
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="bg-white shadow-xl rounded-xl w-full max-w-xl p-8 relative">
                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 text-gray-500 hover:text-gray-800"
                >
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-red-600 mb-6 text-center mt-2">
                    Edit Site: {siteCode}
                </h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
                        <input
                            name="name"
                            placeholder="Site Name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full border rounded px-4 py-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input
                            name="location"
                            placeholder="Location / City"
                            value={form.location}
                            onChange={handleChange}
                            className="w-full border rounded px-4 py-2"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                            <input
                                name="price"
                                type="number"
                                placeholder="Price"
                                value={form.price}
                                onChange={handleChange}
                                className="w-full border rounded px-4 py-2"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Area (sq.ft)</label>
                            <input
                                name="area"
                                type="number"
                                placeholder="Area"
                                value={form.area}
                                onChange={handleChange}
                                className="w-full border rounded px-4 py-2"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Dimension</label>
                            <input
                                name="dimension"
                                placeholder="e.g. 30x40"
                                value={form.dimension}
                                onChange={handleChange}
                                className="w-full border rounded px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Facing</label>
                            <select
                                name="facing"
                                value={form.facing}
                                onChange={handleChange}
                                className="w-full border rounded px-4 py-2 bg-white"
                            >
                                <option value="">— Select Facing —</option>
                                <option value="East">East</option>
                                <option value="West">West</option>
                                <option value="North">North</option>
                                <option value="South">South</option>
                                <option value="North-East">North-East</option>
                                <option value="North-West">North-West</option>
                                <option value="South-East">South-East</option>
                                <option value="South-West">South-West</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-6 py-1">
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                            <input
                                type="checkbox"
                                name="corner_site"
                                checked={form.corner_site}
                                onChange={handleChange}
                                className="w-4 h-4 text-red-600 rounded"
                            />
                            <span>📐 Corner Plot</span>
                        </label>
                    </div>

                    {user?.role === "admin" && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Listing Status (Admin)</label>
                            <select
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                                className="w-full border rounded px-4 py-2 bg-white font-medium"
                            >
                                <option value="pending">⏳ Pending Review</option>
                                <option value="approved">✅ Approved & Published</option>
                                <option value="sold">🏷️ Sold Out</option>
                                <option value="rejected">❌ Rejected</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                        <input
                            name="owner"
                            placeholder="Owner Name"
                            value={form.owner}
                            onChange={handleChange}
                            className="w-full border rounded px-4 py-2"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            name="description"
                            placeholder="Site Description & Details..."
                            value={form.description}
                            onChange={handleChange}
                            className="w-full border rounded px-4 py-2 min-h-[120px]"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className={`w-full text-white py-2 rounded transition-colors ${saving ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                            }`}
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>

                {message && (
                    <p className="mt-4 text-center text-gray-600 font-medium">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}
