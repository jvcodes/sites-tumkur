"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

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

  // Specs
  corner_site?: boolean;
  boundary_marked?: boolean;
  levelled_land?: boolean;
  negotiable?: boolean;
  loan_facility?: boolean;

  // Legal
  bbmp_approved?: boolean;
  a_khata?: boolean;
  clear_title?: boolean;
  bank_loan_approved?: boolean;
  layout_approved?: boolean;

  // Utilities
  borewell_water?: boolean;
  electricity_nearby?: boolean;
  drainage_connection?: boolean;
  asphalt_road_access?: boolean;
}

export default function SiteDetails() {
  const params = useParams();
  const siteCode = params.site_code as string;
  const { user } = useAuth();

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inVisitList, setInVisitList] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // ----------------------------------
  // FETCH SITE DETAILS
  // ----------------------------------
  useEffect(() => {
    const fetchSite = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `http://127.0.0.1:8000/api/sites/${siteCode}/`
        );

        if (!res.ok) {
          throw new Error("Site not found");
        }

        const data: Site = await res.json();
        setSite(data);
        setError(null);
      } catch {
        setError("Failed to load site details");
      } finally {
        setLoading(false);
      }
    };

    fetchSite();
  }, [siteCode]);

  // ----------------------------------
  // CHECK CART & WISHLIST STATUS
  // ----------------------------------
  useEffect(() => {
    if (!site) return;

    const cartRaw = JSON.parse(
      localStorage.getItem("cart") || "[]"
    );
    const wishlistRaw = JSON.parse(
      localStorage.getItem("wishlist") || "[]"
    );

    setInVisitList(
      cartRaw.some(
        (item: any) =>
          (item.site_code || item.code) === site.site_code
      )
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
      ...item, site_code: item.site_code || item.code,
    }));
    const unique = Array.from(new Map(normalized.map((i: Site) => [i.site_code, i])).values());

    localStorage.setItem("wishlist", JSON.stringify(unique));
    setInWishlist(true);
    alert("Added to wishlist ❤️");
  };

  const addToVisitList = () => {
    if (!site || inVisitList) return;

    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    const normalized = [...raw, site].map((item: any) => ({
      ...item, site_code: item.site_code || item.code,
    }));
    const unique = Array.from(new Map(normalized.map((i: Site) => [i.site_code, i])).values());

    localStorage.setItem("cart", JSON.stringify(unique));
    setInVisitList(true);
    alert("Added to Visit List 📋");
  };

  if (loading) return <p className="text-center mt-10 text-xl text-gray-600">Loading site details...</p>;
  if (error || !site) return <div className="text-center mt-20"><h2 className="text-3xl text-gray-800 font-bold mb-4">Site Not Found</h2><p className="text-red-600">{error}</p></div>;

  const validImages = site.images && site.images.length > 0 ? site.images : [site.image || "/no-image.png"];

  // Calculate price per sqft (safely)
  const pricePerSqft = site.area && site.area > 0 ? Math.round(site.price / site.area) : 0;

  return (
    <div className="bg-gray-50 min-h-screen py-10">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">

        {/* LEFT COLUMN: Main content */}
        <div className="space-y-8">

          {/* IDENTIFICATION & HEADER */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <span className="inline-block bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-bold mb-3 border border-red-200 uppercase tracking-widest">
              ID: {site.site_code}
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{site.name || "Real Estate Plot"}</h1>
            <p className="text-gray-600 text-lg flex items-center">
              📍 {site.location} {site.landmark ? `(Near ${site.landmark})` : ""}
            </p>
          </div>

          {/* IMAGE GALLERY */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden border">
              <img
                src={validImages[activeImageIndex]}
                alt={`${site.name} image ${activeImageIndex + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
            {validImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {validImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all ${activeImageIndex === idx ? 'border-red-600 opacity-100 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SPECIFICATIONS */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center gap-2">📐 Site Specifications</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
              <div>
                <p className="text-gray-500 text-sm font-medium">Plot Size</p>
                <p className="text-gray-900 font-semibold">{site.area ? `${site.area} Sq.ft` : "N/A"}</p>
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
                <p className="text-gray-900 font-semibold">{site.corner_site ? "✅ Yes" : "❌ No"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">Boundary Marked</p>
                <p className="text-gray-900 font-semibold">{site.boundary_marked ? "✅ Yes" : "❌ No"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-sm font-medium">Levelled Land</p>
                <p className="text-gray-900 font-semibold">{site.levelled_land ? "✅ Yes" : "❌ No"}</p>
              </div>
            </div>
          </div>

          {/* UTILITIES AND LEGAL GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center gap-2">📄 Legal & Approval</h2>
              <ul className="space-y-3">
                <li className="flex justify-between items-center"><span className="text-gray-700">BBMP Approved:</span> <span className="font-semibold">{site.bbmp_approved ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">A-Khata:</span> <span className="font-semibold">{site.a_khata ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">Clear Title:</span> <span className="font-semibold">{site.clear_title ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">Bank Loan Approved:</span> <span className="font-semibold">{site.bank_loan_approved ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">Layout Approved:</span> <span className="font-semibold">{site.layout_approved ? "✅ Yes" : "❌ No"}</span></li>
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-5 flex items-center gap-2">🚰 Utilities Available</h2>
              <ul className="space-y-3">
                <li className="flex justify-between items-center"><span className="text-gray-700">Borewell Water:</span> <span className="font-semibold">{site.borewell_water ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">Electricity Nearby:</span> <span className="font-semibold">{site.electricity_nearby ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">Drainage Connection:</span> <span className="font-semibold">{site.drainage_connection ? "✅ Yes" : "❌ No"}</span></li>
                <li className="flex justify-between items-center"><span className="text-gray-700">Asphalt Road Access:</span> <span className="font-semibold">{site.asphalt_road_access ? "✅ Yes" : "❌ No"}</span></li>
              </ul>
            </div>
          </div>

          {/* WHAT BUYERS CHECK FIRST */}
          <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6">
            <h2 className="text-xl font-bold text-blue-900 border-b border-blue-200 pb-3 mb-5 flex items-center gap-2">🌟 What Buyers Check First</h2>
            <p className="text-blue-800 mb-4 whitespace-pre-wrap">{site.description}</p>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Sidebar for Pricing & Actions */}
        <div className="relative">
          <div className="sticky top-[100px] bg-white rounded-xl shadow-lg border p-6">
            <p className="text-gray-500 uppercase font-semibold text-xs tracking-wider mb-1">Total Price</p>
            <h2 className="text-4xl font-extrabold text-red-600 mb-4">₹{site.price.toLocaleString()}</h2>

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
                <span className="text-gray-900 font-bold">{site.loan_facility ? "Available" : "Not Available"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={addToVisitList}
                disabled={inVisitList}
                className={`w-full py-4 rounded-lg font-bold text-white text-lg transition-all shadow-md ${inVisitList
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 hover:shadow-lg"
                  }`}
              >
                {inVisitList ? "In Visit List 📋" : "Add to Visit List"}
              </button>

              <button
                onClick={addToWishlist}
                disabled={inWishlist}
                className={`w-full py-3 rounded-lg font-bold border-2 transition-all ${inWishlist
                  ? "border-gray-300 text-gray-400 cursor-not-allowed"
                  : "border-red-600 text-red-600 hover:bg-red-50"
                  }`}
              >
                {inWishlist ? "❤️ Saved to Wishlist" : "❤️ Add to Wishlist"}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-center text-gray-500">Interested in this property?</p>
              <p className="text-xs text-center text-gray-400 mt-1">Add it to your visit list to coordinate a site evaluation.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
