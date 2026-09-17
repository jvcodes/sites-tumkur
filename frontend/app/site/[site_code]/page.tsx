"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import toast from "react-hot-toast";

interface AdjacentSite {
  site_code: string;
  name?: string;
  price?: number;
  location?: string;
}

interface Site {
  site_code: string;
  name: string;
  location: string;
  landmark?: string;
  price: number;
  area?: number;
  dimension?: string;
  facing?: string;
  road_width?: string;
  owner?: string;
  description?: string;
  image?: string;
  images?: string[];
  youtube_url?: string;
  latitude?: number;
  longitude?: number;

  // Specs
  corner_site?: boolean;
  boundary_marked?: boolean;
  levelled_land?: boolean;
  negotiable?: boolean;
  loan_facility?: boolean;

  // Legal
  tuda_approved?: boolean;
  bbmp_approved?: boolean;
  a_khata?: boolean;
  clear_title?: boolean;
  bank_loan_approved?: boolean;
  layout_approved?: boolean;

  // Nearby landmarks with distance
  nearby_landmarks?: Array<{ landmark: string; distance_km?: number | null }>;

  // Utilities
  borewell_water?: boolean;
  electricity_nearby?: boolean;
  drainage_connection?: boolean;
  asphalt_road_access?: boolean;

  // Adjacent properties for navigation
  prev_site?: AdjacentSite | null;
  next_site?: AdjacentSite | null;
}

function shortPrice(price?: number): string {
  if (!price && price !== 0) return "N/A";
  if (price >= 10000000) return `${(price / 10000000).toFixed(2)} Cr`;
  if (price >= 100000) return `${(price / 100000).toFixed(1)} Lakh`;
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function SiteDetails() {
  const params = useParams();
  const siteCode = params.site_code as string;
  const router = useRouter();
  const { user } = useAuth();

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addToCart, isInCart } = useCart();
  const inVisitList = isInCart(siteCode);
  const [inWishlist, setInWishlist] = useState(false);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // ----------------------------------
  // FETCH SITE DETAILS
  // ----------------------------------
  useEffect(() => {
    const fetchSite = async () => {
      try {
        setLoading(true);

        const res = await fetch(`/api/sites/${siteCode}`);

        if (!res.ok) {
          throw new Error("Site not found");
        }

        const data: Site = await res.json();
        setSite(data);
        setError(null);

        // ── PERSONALIZATION: Save preferred location ──
        if (data.location) {
          localStorage.setItem("sitehub_preferred_loc", data.location);
        }

        // Record Analytics Visit
        if (user?.email || user?.phone) {
          fetch("/api/sites/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: user.email || user.phone,
              site_code: siteCode,
            }),
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load site details");
      } finally {
        setLoading(false);
      }
    };

    if (siteCode) {
      fetchSite();
      setActiveImageIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [siteCode, user]);

  // ----------------------------------
  // DETERMINE PREVIOUS & NEXT PROPERTIES
  // Priority: 1. User's active home feed sequence from sessionStorage
  //           2. Backend adjacent properties from MongoDB
  // ----------------------------------
  const { effectivePrevSite, effectiveNextSite } = useMemo(() => {
    let prev: AdjacentSite | null = site?.prev_site || null;
    let next: AdjacentSite | null = site?.next_site || null;

    if (typeof window !== "undefined") {
      try {
        const storedHome = sessionStorage.getItem("homeState");
        if (storedHome) {
          const parsed = JSON.parse(storedHome);
          const feed: any[] = parsed.sites || [];
          const idx = feed.findIndex(
            (s) => (s.site_code || s.id_str || s._id) === siteCode
          );
          if (idx !== -1) {
            if (idx > 0) {
              const p = feed[idx - 1];
              prev = {
                site_code: p.site_code || p.id_str || p._id,
                name: p.name,
                price: p.price,
                location: p.location,
              };
            } else {
              prev = null;
            }
            if (idx < feed.length - 1) {
              const n = feed[idx + 1];
              next = {
                site_code: n.site_code || n.id_str || n._id,
                name: n.name,
                price: n.price,
                location: n.location,
              };
            } else {
              next = null;
            }
          }
        }
      } catch (err) {
        // Fallback to backend prev/next if sessionStorage parsing fails
      }
    }

    return { effectivePrevSite: prev, effectiveNextSite: next };
  }, [site, siteCode]);

  // ----------------------------------
  // BULLETPROOF BACK TO PROPERTIES HANDLER
  // ----------------------------------
  const handleBackToProperties = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    router.push("/");
  };

  // Check if current site is in local storage wishlist
  useEffect(() => {
    if (!site) return;

    const wishlistRaw = JSON.parse(
      localStorage.getItem("wishlist") || "[]"
    );

    setInWishlist(
      wishlistRaw.some(
        (item: any) =>
          (item.site_code || item.code) === site.site_code
      )
    );
  }, [site]);

  // ----------------------------------
  // ACTION FUNCTIONS
  // ----------------------------------
  const addToWishlist = () => {
    if (!site || inWishlist) return;

    const raw = JSON.parse(localStorage.getItem("wishlist") || "[]");
    const normalized = [...raw, site].map((item: any) => ({
      ...item,
      site_code: item.site_code || item.code,
    }));
    const unique = Array.from(
      new Map(normalized.map((i: Site) => [i.site_code, i])).values()
    );

    localStorage.setItem("wishlist", JSON.stringify(unique));
    setInWishlist(true);
    toast.success("Added to wishlist ❤️");
  };

  const addToVisitList = () => {
    if (!site || inVisitList) return;

    addToCart({
      site_code: site.site_code,
      name: site.name,
      location: site.location,
      price: site.price,
      image: site.images?.[0] || site.image || "/no-image.svg",
      images: site.images,
      latitude: site.latitude,
      longitude: site.longitude,
    });

    toast.success("Added to Visit List 📋");
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen pb-10 flex flex-col items-center justify-center pt-20">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xl text-gray-600 font-semibold">Loading property details...</p>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="bg-gray-50 min-h-screen pb-10 flex flex-col items-center pt-20 px-4">
        <h2 className="text-3xl text-gray-800 font-bold mb-4">Property Not Found</h2>
        <p className="text-red-600 mb-8">{error}</p>
        <Link
          href="/"
          onClick={handleBackToProperties}
          className="flex items-center text-white bg-blue-600 hover:bg-blue-700 font-semibold px-6 py-3 rounded-xl shadow-md transition-all active:scale-95"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Properties
        </Link>
      </div>
    );
  }

  const getYoutubeVideoId = (url?: string) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  };

  const youtubeId = getYoutubeVideoId((site as any).youtube_url);

  const media = [];
  if (youtubeId) media.push({ type: "youtube", src: youtubeId });

  const siteImages =
    site.images && site.images.length > 0
      ? site.images
      : site.image
      ? [site.image]
      : [];
  if (siteImages.length === 0 && !youtubeId) siteImages.push("/no-image.svg");

  siteImages.forEach((img) => media.push({ type: "image", src: img }));

  // Calculate price per sqft (safely)
  const pricePerSqft =
    site.area && site.area > 0 ? Math.round(site.price / site.area) : 0;

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* 🔹 STICKY NAVIGATION BAR (Compact & Small) */}
      <div className="sticky top-[57px] md:top-[65px] z-40 bg-white/95 backdrop-blur-md shadow-2xs border-b border-gray-200 px-3 md:px-6 py-1.5 mb-6 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            onClick={handleBackToProperties}
            data-testid="back-to-properties-top"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-gray-700 hover:text-blue-700 hover:bg-gray-100 transition-colors group"
          >
            <span data-testid="back-top-arrow-highlight" className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs group-hover:scale-105 transition-transform">
              ←
            </span>
            <span>Back to Properties</span>
          </Link>

          {/* Quick Prev / Next Adjacent Property Switcher (Small Buttons) */}
          <div className="flex items-center gap-1.5">
            {effectivePrevSite ? (
              <Link
                href={`/site/${effectivePrevSite.site_code}`}
                data-testid="prev-property-top"
                className="px-2.5 py-1 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs font-medium text-gray-700 hover:text-blue-700 transition-all flex items-center gap-1 shadow-2xs group"
                title={`Previous: ${effectivePrevSite.name || effectivePrevSite.site_code}`}
              >
                <span data-testid="prev-arrow-highlight" className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                  ←
                </span>
                <span>Prev</span>
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded-md border border-gray-100 bg-gray-50 text-xs font-normal text-gray-300 cursor-not-allowed flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-400 text-[9px] font-bold flex items-center justify-center">
                  ←
                </span>
                <span>Prev</span>
              </span>
            )}

            {effectiveNextSite ? (
              <Link
                href={`/site/${effectiveNextSite.site_code}`}
                data-testid="next-property-top"
                className="px-2.5 py-1 rounded-md border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs font-medium text-gray-700 hover:text-blue-700 transition-all flex items-center gap-1 shadow-2xs group"
                title={`Next: ${effectiveNextSite.name || effectiveNextSite.site_code}`}
              >
                <span>Next</span>
                <span data-testid="next-arrow-highlight" className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                  →
                </span>
              </Link>
            ) : (
              <span className="px-2.5 py-1 rounded-md border border-gray-100 bg-gray-50 text-xs font-normal text-gray-300 cursor-not-allowed flex items-center gap-1">
                <span>Next</span>
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-400 text-[9px] font-bold flex items-center justify-center">
                  →
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        {/* LEFT COLUMN: Main content */}
        <div className="space-y-8">
          {/* IDENTIFICATION & HEADER */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <span className="inline-block bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-bold mb-3 border border-red-200 uppercase tracking-widest">
              ID: {site.site_code}
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
              {site.name || "Real Estate Plot"}
            </h1>
            <p className="text-gray-600 text-lg flex items-center">
              📍 {site.location}{" "}
              {site.landmark
                ? site.landmark.toLowerCase().startsWith("near")
                  ? `(${site.landmark})`
                  : `(Near ${site.landmark})`
                : ""}
            </p>
          </div>

          {/* IMAGE GALLERY */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="relative w-full h-80 sm:h-96 bg-gray-100 rounded-lg overflow-hidden border">
              {media[activeImageIndex]?.type === "youtube" ? (
                <iframe
                  src={`https://www.youtube.com/embed/${media[activeImageIndex].src}?rel=0&controls=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <img
                  key={media[activeImageIndex]?.src}
                  src={media[activeImageIndex]?.src}
                  alt={`${site.name} image ${activeImageIndex + 1}`}
                  className="w-full h-full object-contain transition-opacity duration-500 ease-in-out opacity-0 animate-fade-in"
                  onLoad={(e) => (e.currentTarget.style.opacity = "1")}
                  loading="eager"
                />
              )}
            </div>
            {media.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {media.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                      activeImageIndex === idx
                        ? "border-[var(--color-accent)] opacity-100 shadow-md"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    {item.type === "youtube" ? (
                      <div className="w-full h-full bg-black flex items-center justify-center text-white text-xs font-bold">
                        ▶ VIDEO
                      </div>
                    ) : (
                      <img
                        src={item.src}
                        alt={`Thumbnail ${idx}`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover transition-opacity duration-300 opacity-0"
                        onLoad={(e) => (e.currentTarget.style.opacity = "1")}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SPECIFICATIONS */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center gap-2">
              📐 Site Specifications
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
              <div>
                <p className="text-gray-500 text-sm font-medium">Plot Size</p>
                <p className="text-gray-900 font-semibold">
                  {site.area ? `${site.area} Sq.ft` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Dimension</p>
                <p className="text-gray-900 font-semibold">{site.dimension || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Facing</p>
                <p className="text-gray-900 font-semibold">{site.facing || "N/A"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Road Width</p>
                <p className="text-gray-900 font-semibold">{site.road_width || "N/A"}</p>
              </div>

              <div>
                <p className="text-gray-500 text-sm font-medium">Corner Site</p>
                <p className="text-gray-900 font-semibold">
                  {site.corner_site ? "✅ Yes" : "❌ No"}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Boundary Marked</p>
                <p className="text-gray-900 font-semibold">
                  {site.boundary_marked ? "✅ Yes" : "❌ No"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-sm font-medium">Levelled Land</p>
                <p className="text-gray-900 font-semibold">
                  {site.levelled_land ? "✅ Yes" : "❌ No"}
                </p>
              </div>
            </div>
          </div>

          {/* 📍 NEARBY KEY LANDMARKS & DISTANCES */}
          {site.nearby_landmarks && site.nearby_landmarks.length > 0 && (
            <div data-testid="nearby-landmarks-section" className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4 flex items-center gap-2">
                📍 Key Landmarks & Distances
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {site.nearby_landmarks.map((lm, idx) => (
                  <div key={idx} data-testid="landmark-item" className="flex items-center justify-between p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-8 h-8 rounded-full bg-white text-blue-600 shadow-xs border border-blue-100 flex items-center justify-center text-sm flex-shrink-0">
                        📍
                      </span>
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {lm.landmark}
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-blue-600 text-white shadow-xs flex-shrink-0">
                      {lm.distance_km != null ? `${lm.distance_km} km` : "Nearby"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UTILITIES AND LEGAL GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center gap-2">
                📄 Legal & Approval
              </h2>
              <ul className="space-y-3">
                <li className="flex justify-between items-center" data-testid="tuda-approved-item">
                  <span className="text-gray-700">TUDA Approved:</span>{" "}
                  <span data-testid="tuda-approved-status" className="font-semibold">{(site.tuda_approved ?? site.bbmp_approved) ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">A-Khata:</span>{" "}
                  <span className="font-semibold">{site.a_khata ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Clear Title:</span>{" "}
                  <span className="font-semibold">{site.clear_title ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Bank Loan Approved:</span>{" "}
                  <span className="font-semibold">{site.bank_loan_approved ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Layout Approved:</span>{" "}
                  <span className="font-semibold">{site.layout_approved ? "✅ Yes" : "❌ No"}</span>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center gap-2">
                🚰 Utilities Available
              </h2>
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Borewell Water:</span>{" "}
                  <span className="font-semibold">{site.borewell_water ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Electricity Nearby:</span>{" "}
                  <span className="font-semibold">{site.electricity_nearby ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Drainage Connection:</span>{" "}
                  <span className="font-semibold">{site.drainage_connection ? "✅ Yes" : "❌ No"}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-700">Asphalt Road Access:</span>{" "}
                  <span className="font-semibold">{site.asphalt_road_access ? "✅ Yes" : "❌ No"}</span>
                </li>
              </ul>
            </div>
          </div>

          {/* WHAT BUYERS CHECK FIRST */}
          {site.description && (
            <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6">
              <h2 className="text-xl font-bold text-blue-900 border-b border-blue-200 pb-3 mb-5 flex items-center gap-2">
                🌟 What Buyers Check First
              </h2>
              <p className="text-blue-800 whitespace-pre-wrap leading-relaxed">{site.description}</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sticky Sidebar for Pricing & Actions */}
        <div className="relative">
          <div className="sticky top-[135px] bg-white rounded-xl shadow-lg border p-6">
            <p className="text-gray-500 uppercase font-semibold text-xs tracking-wider mb-1">
              Total Price
            </p>
            <h2 className="text-4xl font-extrabold text-red-600 mb-4">
              ₹{site.price.toLocaleString()}
            </h2>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 border border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">Price per Sq.ft:</span>
                <span className="text-gray-900 font-bold">₹{pricePerSqft.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">Negotiable:</span>
                <span className="text-gray-900 font-bold">{site.negotiable ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 font-medium">Loan Facility:</span>
                <span className="text-gray-900 font-bold">
                  {site.loan_facility ? "Available" : "Not Available"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={addToVisitList}
                disabled={inVisitList}
                className={`w-full py-4 rounded-lg font-bold text-white text-lg transition-all shadow-md ${
                  inVisitList
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 hover:shadow-lg"
                }`}
              >
                {inVisitList ? "In Visit List 📋" : "Add to Visit List"}
              </button>

              <button
                onClick={addToWishlist}
                disabled={inWishlist}
                className={`w-full py-3 rounded-lg font-bold border-2 transition-all ${
                  inWishlist
                    ? "border-gray-300 text-gray-400 cursor-not-allowed"
                    : "border-red-600 text-red-600 hover:bg-red-50"
                }`}
              >
                {inWishlist ? "❤️ Saved to Wishlist" : "❤️ Add to Wishlist"}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-center text-gray-500">Interested in this property?</p>
              <p className="text-xs text-center text-gray-400 mt-1">
                Add it to your visit list to coordinate a site evaluation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🔹 BOTTOM NAVIGATION (Compact & Small Buttons) */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 mt-8">
        <div className="flex items-center justify-between gap-2 py-2.5 px-3 md:px-4 bg-white rounded-xl border border-gray-200 shadow-2xs">
          {/* Previous Property Button (Small) */}
          {effectivePrevSite ? (
            <Link
              href={`/site/${effectivePrevSite.site_code}`}
              data-testid="prev-property-bottom"
              className="px-2.5 md:px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs font-semibold text-gray-700 hover:text-blue-700 transition-all flex items-center gap-1.5 shadow-2xs group"
              title={`Previous: ${effectivePrevSite.name || effectivePrevSite.site_code}`}
            >
              <span data-testid="prev-bottom-arrow-highlight" className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                ←
              </span>
              <span>Prev</span>
            </Link>
          ) : (
            <span className="px-2.5 md:px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-xs font-normal text-gray-300 cursor-not-allowed flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-400 text-[9px] font-bold flex items-center justify-center">
                ←
              </span>
              <span>Prev</span>
            </span>
          )}

          {/* Back to Properties Button (Small) */}
          <Link
            href="/"
            onClick={handleBackToProperties}
            data-testid="back-to-properties-bottom"
            className="px-3 md:px-4 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95 group"
          >
            <span data-testid="back-bottom-arrow-highlight" className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
              ←
            </span>
            <span>Back to All Properties</span>
          </Link>

          {/* Next Property Button (Small) */}
          {effectiveNextSite ? (
            <Link
              href={`/site/${effectiveNextSite.site_code}`}
              data-testid="next-property-bottom"
              className="px-2.5 md:px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-xs font-semibold text-gray-700 hover:text-blue-700 transition-all flex items-center gap-1.5 shadow-2xs group"
              title={`Next: ${effectiveNextSite.name || effectiveNextSite.site_code}`}
            >
              <span>Next</span>
              <span data-testid="next-bottom-arrow-highlight" className="w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                →
              </span>
            </Link>
          ) : (
            <span className="px-2.5 md:px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-xs font-normal text-gray-300 cursor-not-allowed flex items-center gap-1.5">
              <span>Next</span>
              <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-400 text-[9px] font-bold flex items-center justify-center">
                →
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
