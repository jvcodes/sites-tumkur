"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function UploadSitePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    location: "",
    landmark: "",
    price: "",
    area: "",
    dimension: "",
    facing: "",
    road_width: "",
    description: "",
    youtube_url: "",
    latitude: "",
    longitude: "",
  });

  // Specs
  const [cornerSite, setCornerSite] = useState(false);
  const [boundaryMarked, setBoundaryMarked] = useState(false);
  const [levelledLand, setLevelledLand] = useState(false);

  // Commerce
  const [negotiable, setNegotiable] = useState(false);
  const [loanFacility, setLoanFacility] = useState(false);

  // Legal
  const [bbmpApproved, setBbmpApproved] = useState(false);
  const [aKhata, setAKhata] = useState(false);
  const [clearTitle, setClearTitle] = useState(false);
  const [bankLoanApproved, setBankLoanApproved] = useState(false);
  const [layoutApproved, setLayoutApproved] = useState(false);

  // Utilities
  const [borewellWater, setBorewellWater] = useState(false);
  const [electricityNearby, setElectricityNearby] = useState(false);
  const [drainageConnection, setDrainageConnection] = useState(false);
  const [asphaltRoadAccess, setAsphaltRoadAccess] = useState(false);

  const [images, setImages] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    toast.loading("Fetching location...", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm({
          ...form,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        });
        toast.success("Location retrieved!", { id: "geo" });
      },
      () => {
        toast.error("Unable to retrieve your location. Please check browser permissions.", { id: "geo" });
      }
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("You must be logged in to upload a site.");
      router.push("/login");
      return;
    }

    if (images.length === 0) {
      setMessage("❌ Please upload at least one image.");
      return;
    }

    setLoading(true);
    setMessage("");

    const data = new FormData();
    data.append("user_id", user.email);
    data.append("owner", user.name);

    // Core strings
    data.append("name", form.name || "Untitled Site");
    data.append("location", form.location);
    data.append("landmark", form.landmark);
    data.append("price", form.price);
    data.append("area", form.area);
    data.append("dimension", form.dimension);
    data.append("facing", form.facing);
    data.append("road_width", form.road_width);
    data.append("description", form.description);
    data.append("youtube_url", form.youtube_url);
    data.append("latitude", form.latitude);
    data.append("longitude", form.longitude);

    // Booleans
    data.append("corner_site", String(cornerSite));
    data.append("boundary_marked", String(boundaryMarked));
    data.append("levelled_land", String(levelledLand));
    data.append("negotiable", String(negotiable));
    data.append("loan_facility", String(loanFacility));

    data.append("bbmp_approved", String(bbmpApproved));
    data.append("a_khata", String(aKhata));
    data.append("clear_title", String(clearTitle));
    data.append("bank_loan_approved", String(bankLoanApproved));
    data.append("layout_approved", String(layoutApproved));

    data.append("borewell_water", String(borewellWater));
    data.append("electricity_nearby", String(electricityNearby));
    data.append("drainage_connection", String(drainageConnection));
    data.append("asphalt_road_access", String(asphaltRoadAccess));

    // Images
    images.forEach((img) => data.append("images", img));

    try {
      const res = await fetch("/api/sites/create", {
        method: "POST",
        body: data,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed. Please check your connection.");
      }

      setMessage("✅ Site uploaded successfully! Redirecting to your sites...");
      setTimeout(() => {
        router.push("/profile/my-sites");
      }, 2000);

    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center border border-gray-100">
          <div className="text-5xl mb-4">🏡</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Required</h2>
          <p className="text-gray-500 mb-6">
            Please <a href="/login" className="text-blue-600 font-semibold hover:underline">log in</a> to list your site or plot on SiteHub. It&apos;s free!
          </p>
          <a
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md"
          >
            Login with Phone
          </a>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden">
        <div className="bg-red-600 py-6 px-8 text-white">
          <h1 className="text-2xl font-bold">List Your Site</h1>
          <p className="opacity-80 text-sm mt-1">Provide comprehensive details to attract serious buyers.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">

          {/* SECTION: BASIC INFO */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Location & Basic Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Plot / Project Name (Optional)</label>
                <input name="name" placeholder="e.g. Silver Oak Layout" value={form.name} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">City / Location <span className="text-red-500">*</span></label>
                <input name="location" placeholder="e.g. Sarjapur Road, Bengaluru" value={form.location} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Landmark</label>
                <input name="landmark" placeholder="e.g. Near Wipro SEZ" value={form.landmark} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">YouTube Link (Video Walkthrough)</label>
                <input name="youtube_url" type="url" placeholder="https://youtube.com/watch?v=..." value={form.youtube_url} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>

              <div className="md:col-span-2 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm text-gray-600 font-bold">Map Coordinates (Optional)</label>
                  <button 
                    type="button" 
                    onClick={handleGetLocation}
                    className="text-sm bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded hover:bg-blue-100 transition"
                  >
                    📍 Use Current Location
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input name="latitude" placeholder="Latitude (e.g. 13.33)" value={form.latitude} onChange={handleChange} className="w-full border rounded px-3 py-2 bg-gray-50" />
                  </div>
                  <div>
                    <input name="longitude" placeholder="Longitude (e.g. 77.10)" value={form.longitude} onChange={handleChange} className="w-full border rounded px-3 py-2 bg-gray-50" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: SPECS */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Site Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Plot Size (Sq.ft) <span className="text-red-500">*</span></label>
                <input name="area" type="number" placeholder="1200" value={form.area} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Dimension <span className="text-red-500">*</span></label>
                <input name="dimension" placeholder="30 x 40" value={form.dimension} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Facing <span className="text-red-500">*</span></label>
                <select name="facing" value={form.facing} onChange={handleChange} className="w-full border rounded px-3 py-2 bg-white" required>
                  <option value="">Select Facing</option>
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
                <label className="block text-sm text-gray-600 mb-1">Total Price (₹) <span className="text-red-500">*</span></label>
                <input name="price" type="number" placeholder="5200000" value={form.price} onChange={handleChange} className="w-full border rounded px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Road Width</label>
                <input name="road_width" placeholder="e.g. 30 Feet" value={form.road_width} onChange={handleChange} className="w-full border rounded px-3 py-2" />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4">
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={cornerSite} onChange={e => setCornerSite(e.target.checked)} className="rounded text-red-600" /> <span>Corner Site</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={boundaryMarked} onChange={e => setBoundaryMarked(e.target.checked)} className="rounded text-red-600" /> <span>Boundary Marked</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={levelledLand} onChange={e => setLevelledLand(e.target.checked)} className="rounded text-red-600" /> <span>Levelled Land</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={negotiable} onChange={e => setNegotiable(e.target.checked)} className="rounded text-red-600" /> <span>Price Negotiable</span></label>
            </div>
          </section>

          {/* SECTION: LEGAL */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Legal & Approval Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={bbmpApproved} onChange={e => setBbmpApproved(e.target.checked)} className="rounded text-red-600" /> <span>BBMP Approved</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={aKhata} onChange={e => setAKhata(e.target.checked)} className="rounded text-red-600" /> <span>A-Khata</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={clearTitle} onChange={e => setClearTitle(e.target.checked)} className="rounded text-red-600" /> <span>Clear Title</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={layoutApproved} onChange={e => setLayoutApproved(e.target.checked)} className="rounded text-red-600" /> <span>Layout Approved</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={loanFacility} onChange={e => setLoanFacility(e.target.checked)} className="rounded text-red-600" /> <span>Loan Facility</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={bankLoanApproved} onChange={e => setBankLoanApproved(e.target.checked)} className="rounded text-red-600" /> <span>Bank Loan Apprvd</span></label>
            </div>
          </section>

          {/* SECTION: UTILITIES */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Utilities Available</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={borewellWater} onChange={e => setBorewellWater(e.target.checked)} className="rounded text-red-600" /> <span>Borewell Water</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={electricityNearby} onChange={e => setElectricityNearby(e.target.checked)} className="rounded text-red-600" /> <span>Electricity Near</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={drainageConnection} onChange={e => setDrainageConnection(e.target.checked)} className="rounded text-red-600" /> <span>Drainage Conn.</span></label>
              <label className="flex items-center space-x-2 text-sm text-gray-700"><input type="checkbox" checked={asphaltRoadAccess} onChange={e => setAsphaltRoadAccess(e.target.checked)} className="rounded text-red-600" /> <span>Asphalt Road</span></label>
            </div>
          </section>

          {/* SECTION: DESCRIPTION */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Description <span className="text-red-500">*</span></h2>
            <textarea
              name="description"
              placeholder="Provide a detailed description of the property, nearby schools, hospitals, or any future developments..."
              value={form.description}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 min-h-[120px]"
              required
            />
          </section>

          {/* SECTION: IMAGES */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">Photos (Multiple allowed) <span className="text-red-500">*</span></h2>
            <div className="relative border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg p-8 text-center hover:bg-gray-100 transition overflow-hidden">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setImages((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                  e.target.value = ""; // Reset input so same file can be selected again
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="pointer-events-none">
                <span className="text-4xl">📸</span>
                <p className="mt-3 text-gray-700 font-semibold">Click or drag images to upload</p>
                <p className="text-xs text-gray-500 mt-1">JPEG, PNG up to 10MB each</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((file, idx) => {
                  const objectUrl = URL.createObjectURL(file);
                  return (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-[4/3] shadow-sm">
                      <img 
                        src={objectUrl} 
                        alt={`preview-${idx}`} 
                        className="w-full h-full object-cover" 
                        onLoad={() => URL.revokeObjectURL(objectUrl)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setImages((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 hover:scale-110 shadow-lg z-20"
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SUBMIT */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg text-white font-semibold text-lg transition-colors ${loading ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 shadow-md"
                }`}
            >
              {loading ? "Uploading..." : "Publish Site"}
            </button>
            {message && (
              <p className={`mt-4 text-center font-medium ${message.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                {message}
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
