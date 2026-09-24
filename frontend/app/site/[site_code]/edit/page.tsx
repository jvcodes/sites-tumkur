"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import Link from "next/link";

interface LandmarkItem {
    landmark: string;
    distance_km?: number | null;
}

interface Site {
    site_code: string;
    name: string;
    location: string;
    price: number;
    area?: number;
    owner?: string;
    uploaded_phone?: string;
    user_id?: string;
    description?: string;
    dimension?: string;
    facing?: string;
    road_width?: string;
    landmark?: string;
    category?: string;
    ownership_type?: string;
    availability?: string;
    zoning_type?: string;
    latitude?: number;
    longitude?: number;
    corner_site?: boolean;
    boundary_marked?: boolean;
    levelled_land?: boolean;
    negotiable?: boolean;
    loan_facility?: boolean;
    tuda_approved?: boolean;
    bbmp_approved?: boolean;
    a_khata?: boolean;
    clear_title?: boolean;
    bank_loan_approved?: boolean;
    layout_approved?: boolean;
    borewell_water?: boolean;
    electricity_nearby?: boolean;
    drainage_connection?: boolean;
    asphalt_road_access?: boolean;
    youtube_url?: string;
    images?: string[];
    image?: string;
    nearby_landmarks?: LandmarkItem[];
    status?: string;
}

export default function EditSitePage() {
    const params = useParams();
    const router = useRouter();
    const siteCode = params.site_code as string;
    const { user, loading: authLoading } = useAuth();

    const [form, setForm] = useState({
        name: "",
        location: "",
        price: "",
        area: "",
        dimension: "",
        facing: "",
        road_width: "",
        landmark: "",
        category: "Residential Plot",
        ownership_type: "Freehold",
        availability: "Immediate",
        zoning_type: "Residential",
        owner: "",
        uploaded_phone: "",
        latitude: "",
        longitude: "",
        youtube_url: "",
        description: "",
        status: "approved",
        // Features & Booleans
        corner_site: false,
        boundary_marked: false,
        levelled_land: false,
        negotiable: false,
        loan_facility: false,
        tuda_approved: false,
        a_khata: false,
        clear_title: false,
        bank_loan_approved: false,
        layout_approved: false,
        borewell_water: false,
        electricity_nearby: false,
        drainage_connection: false,
        asphalt_road_access: false,
    });

    const [images, setImages] = useState<string[]>([]);
    const [nearbyLandmarks, setNearbyLandmarks] = useState<LandmarkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingImage, setDeletingImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (authLoading) return;

        const fetchSite = async () => {
            try {
                setLoading(true);
                setError(null);
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
                    price: data.price != null ? data.price.toString() : "",
                    area: data.area != null ? data.area.toString() : "",
                    dimension: data.dimension || "",
                    facing: data.facing || "",
                    road_width: data.road_width || "",
                    landmark: data.landmark || "",
                    category: data.category || "Residential Plot",
                    ownership_type: data.ownership_type || "Freehold",
                    availability: data.availability || "Immediate",
                    zoning_type: data.zoning_type || "Residential",
                    owner: data.owner || "",
                    uploaded_phone: data.uploaded_phone || "",
                    latitude: data.latitude != null ? data.latitude.toString() : "",
                    longitude: data.longitude != null ? data.longitude.toString() : "",
                    youtube_url: data.youtube_url || "",
                    description: data.description || "",
                    status: data.status || "approved",
                    corner_site: Boolean(data.corner_site),
                    boundary_marked: Boolean(data.boundary_marked),
                    levelled_land: Boolean(data.levelled_land),
                    negotiable: Boolean(data.negotiable),
                    loan_facility: Boolean(data.loan_facility),
                    tuda_approved: Boolean(data.tuda_approved ?? data.bbmp_approved),
                    a_khata: Boolean(data.a_khata),
                    clear_title: Boolean(data.clear_title),
                    bank_loan_approved: Boolean(data.bank_loan_approved),
                    layout_approved: Boolean(data.layout_approved),
                    borewell_water: Boolean(data.borewell_water),
                    electricity_nearby: Boolean(data.electricity_nearby),
                    drainage_connection: Boolean(data.drainage_connection),
                    asphalt_road_access: Boolean(data.asphalt_road_access),
                });

                const loadedImages = data.images && data.images.length > 0
                    ? data.images
                    : data.image ? [data.image] : [];
                setImages(loadedImages);

                if (Array.isArray(data.nearby_landmarks)) {
                    setNearbyLandmarks(data.nearby_landmarks);
                }
            } catch {
                setError("Failed to load site details");
            } finally {
                setLoading(false);
            }
        };

        fetchSite();
    }, [siteCode, user, authLoading]);

    const handleChange = (e: any) => {
        const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setForm(prev => ({ ...prev, [e.target.name]: value }));
    };

    const handleAddLandmark = () => {
        setNearbyLandmarks(prev => [...prev, { landmark: "", distance_km: null }]);
    };

    const handleLandmarkChange = (index: number, field: "landmark" | "distance_km", val: any) => {
        setNearbyLandmarks(prev => {
            const updated = [...prev];
            if (field === "distance_km") {
                updated[index].distance_km = val === "" ? null : parseFloat(val);
            } else {
                updated[index].landmark = val;
            }
            return updated;
        });
    };

    const handleRemoveLandmark = (index: number) => {
        setNearbyLandmarks(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleDeleteImage = async (imageUrl: string) => {
        if (!confirm("Are you sure you want to delete this photo?")) return;
        setDeletingImage(imageUrl);
        try {
            const res = await fetch("/api/sites/images/delete/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ site_code: siteCode, image_url: imageUrl }),
            });
            if (res.ok) {
                setImages(prev => prev.filter(img => img !== imageUrl));
            } else {
                alert("Failed to delete image.");
            }
        } catch {
            alert("Error deleting image.");
        } finally {
            setDeletingImage(null);
        }
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");

        const validLandmarks = nearbyLandmarks
            .filter(lm => lm.landmark && lm.landmark.trim() !== "")
            .map(lm => ({
                landmark: lm.landmark.trim(),
                distance_km: lm.distance_km != null && !isNaN(lm.distance_km) ? Number(lm.distance_km) : null,
            }));

        const updateData: any = {
            name: form.name,
            location: form.location,
            price: Number(form.price),
            area: form.area ? Number(form.area) : null,
            dimension: form.dimension || null,
            facing: form.facing || null,
            road_width: form.road_width || null,
            landmark: form.landmark || null,
            category: form.category || null,
            ownership_type: form.ownership_type || null,
            availability: form.availability || null,
            zoning_type: form.zoning_type || null,
            owner: form.owner,
            uploaded_phone: form.uploaded_phone || null,
            latitude: form.latitude ? parseFloat(form.latitude) : null,
            longitude: form.longitude ? parseFloat(form.longitude) : null,
            youtube_url: form.youtube_url || null,
            description: form.description,
            corner_site: Boolean(form.corner_site),
            boundary_marked: Boolean(form.boundary_marked),
            levelled_land: Boolean(form.levelled_land),
            negotiable: Boolean(form.negotiable),
            loan_facility: Boolean(form.loan_facility),
            tuda_approved: Boolean(form.tuda_approved),
            a_khata: Boolean(form.a_khata),
            clear_title: Boolean(form.clear_title),
            bank_loan_approved: Boolean(form.bank_loan_approved),
            layout_approved: Boolean(form.layout_approved),
            borewell_water: Boolean(form.borewell_water),
            electricity_nearby: Boolean(form.electricity_nearby),
            drainage_connection: Boolean(form.drainage_connection),
            asphalt_road_access: Boolean(form.asphalt_road_access),
            nearby_landmarks: validLandmarks,
        };

        if (user?.role === "admin" && form.status) {
            updateData.status = form.status;
        }

        try {
            const res = await fetch(
                `/api/sites/update-by-code/${siteCode}/`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Update failed (${res.status}): ${errText}`);
            }

            setMessage("✅ Site updated successfully!");
            setTimeout(() => {
                router.push(`/site/${siteCode}`);
            }, 1200);
        } catch (err: any) {
            setMessage(`❌ ${err?.message || "Failed to update site. Please check the inputs."}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-gray-600 font-semibold">Loading site details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
                <p className="text-red-600 text-center text-xl font-bold mb-4">{error}</p>
                <button
                    onClick={() => router.push(`/site/${siteCode}`)}
                    className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold shadow hover:bg-gray-300 transition"
                >
                    Return to Site
                </button>
            </div>
        );
    }

    if (!authorized) return null;

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl p-6 sm:p-8 border border-gray-100 relative">
                {/* Top Nav Header */}
                <div className="flex items-center justify-between border-b pb-4 mb-6">
                    <button
                        onClick={() => router.back()}
                        className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
                    >
                        ← Back
                    </button>
                    <div className="text-center">
                        <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                            {siteCode}
                        </span>
                        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1">
                            Edit Property Details
                        </h1>
                    </div>
                    <Link
                        href={`/site/${siteCode}`}
                        target="_blank"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                    >
                        Live ↗
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ── 1. CORE SPECIFICATIONS & PRICING ── */}
                    <div className="bg-gray-50/70 p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            🏗️ Basic Specifications & Pricing
                        </h2>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Property Title / Name *</label>
                            <input
                                name="name"
                                placeholder="e.g. Prime Corner Plot in Batawadi"
                                value={form.name}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Location / Locality *</label>
                                <input
                                    name="location"
                                    placeholder="e.g. Batawadi, Tumkur"
                                    value={form.location}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nearby Landmark Text</label>
                                <input
                                    name="landmark"
                                    placeholder="e.g. Near Batawadi Bus Stand"
                                    value={form.landmark}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Total Price (₹) *</label>
                                <input
                                    name="price"
                                    type="number"
                                    placeholder="e.g. 2500000"
                                    value={form.price}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Total Area (sq.ft)</label>
                                <input
                                    name="area"
                                    type="number"
                                    placeholder="e.g. 1200"
                                    value={form.area}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Dimensions</label>
                                <input
                                    name="dimension"
                                    placeholder="e.g. 30x40"
                                    value={form.dimension}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Facing</label>
                                <select
                                    name="facing"
                                    value={form.facing}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
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
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Road Width (ft)</label>
                                <input
                                    name="road_width"
                                    placeholder="e.g. 30 ft"
                                    value={form.road_width}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                                <input
                                    name="category"
                                    placeholder="e.g. Residential Plot"
                                    value={form.category}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 2. SELLER & CONTACT & MAP COORDINATES ── */}
                    <div className="bg-gray-50/70 p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            👤 Seller & Location Coordinates
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Seller / Owner Name *</label>
                                <input
                                    name="owner"
                                    placeholder="e.g. Ramesh Kumar"
                                    value={form.owner}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone Number</label>
                                <input
                                    name="uploaded_phone"
                                    type="tel"
                                    placeholder="e.g. 9876543210"
                                    value={form.uploaded_phone}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Latitude (GPS)</label>
                                <input
                                    name="latitude"
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 13.340881"
                                    value={form.latitude}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Longitude (GPS)</label>
                                <input
                                    name="longitude"
                                    type="number"
                                    step="any"
                                    placeholder="e.g. 77.100601"
                                    value={form.longitude}
                                    onChange={handleChange}
                                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── 3. FEATURES, LEGAL & UTILITIES (CHECKBOXES) ── */}
                    <div className="bg-gray-50/70 p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            🏷️ Plot Features & Pricing Options
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="corner_site"
                                    checked={form.corner_site}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>📐 Corner Plot</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="boundary_marked"
                                    checked={form.boundary_marked}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Boundary Marked</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="levelled_land"
                                    checked={form.levelled_land}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Levelled Land</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="negotiable"
                                    checked={form.negotiable}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Price Negotiable</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="loan_facility"
                                    checked={form.loan_facility}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Loan Facility</span>
                            </label>
                        </div>

                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider pt-2 border-t flex items-center gap-2">
                            📄 Legal & Approvals
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="tuda_approved"
                                    checked={form.tuda_approved}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>TUDA Approved</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="a_khata"
                                    checked={form.a_khata}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>A-Khata</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="clear_title"
                                    checked={form.clear_title}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Clear Title</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="bank_loan_approved"
                                    checked={form.bank_loan_approved}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Bank Loan Approved</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="layout_approved"
                                    checked={form.layout_approved}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Layout Approved</span>
                            </label>
                        </div>

                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider pt-2 border-t flex items-center gap-2">
                            🚰 Utilities Available
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="borewell_water"
                                    checked={form.borewell_water}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Borewell Water</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="electricity_nearby"
                                    checked={form.electricity_nearby}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Electricity Nearby</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="drainage_connection"
                                    checked={form.drainage_connection}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Drainage Connection</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="asphalt_road_access"
                                    checked={form.asphalt_road_access}
                                    onChange={handleChange}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>Asphalt Road</span>
                            </label>
                        </div>
                    </div>

                    {/* ── 4. KEY NEARBY LANDMARKS & DISTANCES ── */}
                    <div className="bg-gray-50/70 p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                📍 Key Nearby Landmarks (Public Distances)
                            </h2>
                            <button
                                type="button"
                                onClick={handleAddLandmark}
                                className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition"
                            >
                                + Add Landmark
                            </button>
                        </div>

                        {nearbyLandmarks.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No structured landmarks configured for this plot yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {nearbyLandmarks.map((lm, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            placeholder="Landmark name (e.g. Tumkur Railway Station)"
                                            value={lm.landmark}
                                            onChange={(e) => handleLandmarkChange(idx, "landmark", e.target.value)}
                                            className="flex-1 border rounded-lg px-3 py-1.5 text-xs bg-white"
                                        />
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Distance (km)"
                                            value={lm.distance_km ?? ""}
                                            onChange={(e) => handleLandmarkChange(idx, "distance_km", e.target.value)}
                                            className="w-28 border rounded-lg px-3 py-1.5 text-xs bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLandmark(idx)}
                                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg w-8 h-8 flex items-center justify-center text-xs font-bold transition"
                                            title="Remove"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── 5. MEDIA & PHOTOS ── */}
                    <div className="bg-gray-50/70 p-4 sm:p-5 rounded-xl border border-gray-200 space-y-4">
                        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                            🎥 Media & Photo Gallery
                        </h2>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">YouTube Walkthrough Video URL</label>
                            <input
                                name="youtube_url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={form.youtube_url}
                                onChange={handleChange}
                                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                            />
                        </div>

                        {images.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-2">Existing Photos ({images.length})</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {images.map((img, idx) => (
                                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-gray-200 bg-white aspect-video shadow-2xs">
                                            <img
                                                src={img}
                                                alt={`Site image ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteImage(img)}
                                                disabled={deletingImage === img}
                                                className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md transition cursor-pointer"
                                                title="Delete photo"
                                            >
                                                {deletingImage === img ? "…" : "✕"}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 6. DESCRIPTION ── */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            🌟 Description (What Buyers Check First)
                        </label>
                        <textarea
                            name="description"
                            placeholder="Detailed highlights, boundary notes, or developer amenities..."
                            value={form.description}
                            onChange={handleChange}
                            className="w-full border rounded-lg px-3 py-2 text-sm min-h-[110px]"
                        />
                    </div>

                    {/* ── 7. ADMIN STATUS (ADMIN ONLY) ── */}
                    {user?.role === "admin" && (
                        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
                            <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                                🔒 Listing Status (Admin Privileges)
                            </label>
                            <select
                                name="status"
                                value={form.status}
                                onChange={handleChange}
                                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white font-semibold text-gray-800"
                            >
                                <option value="pending">⏳ Pending Review</option>
                                <option value="approved">✅ Approved & Published</option>
                                <option value="sold">🏷️ Sold Out</option>
                                <option value="rejected">❌ Rejected</option>
                            </select>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className={`w-full text-white py-3 rounded-xl font-bold text-base transition-all shadow-md ${
                            saving ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 active:scale-[0.99]"
                        }`}
                    >
                        {saving ? "Saving Changes..." : "💾 Save All Changes"}
                    </button>
                </form>

                {message && (
                    <div className={`mt-4 p-3 rounded-xl text-center text-sm font-bold ${
                        message.startsWith("✅") ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
                    }`}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
