"use client";

import { useState } from "react";

export default function UploadSitePage() {
  const [form, setForm] = useState({
    name: "",
    location: "",
    price: "",
    owner: "",
  });

  const [image, setImage] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const data = new FormData();
    data.append("name", form.name);
    data.append("location", form.location);
    data.append("price", form.price);
    data.append("owner", form.owner);

    if (image) {
      data.append("image", image);
    }

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/api/sites/create/",
        {
          method: "POST",
          body: data,
        }
      );

      if (!res.ok) throw new Error("Upload failed");

      setMessage("✅ Site uploaded! Waiting for admin approval.");
      setForm({ name: "", location: "", price: "", owner: "" });
      setImage(null);
    } catch {
      setMessage("❌ Failed to upload site");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-xl w-full max-w-xl p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-6 text-center">
          Upload Your Site
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            placeholder="Site Name"
            value={form.name}
            onChange={handleChange}
            className="w-full border rounded px-4 py-2"
            required
          />

          <input
            name="location"
            placeholder="Location / City"
            value={form.location}
            onChange={handleChange}
            className="w-full border rounded px-4 py-2"
            required
          />

          <input
            name="price"
            type="number"
            placeholder="Price"
            value={form.price}
            onChange={handleChange}
            className="w-full border rounded px-4 py-2"
            required
          />

          <input
            name="owner"
            placeholder="Owner Name"
            value={form.owner}
            onChange={handleChange}
            className="w-full border rounded px-4 py-2"
            required
          />

          {/* IMAGE UPLOAD */}
          <div className="border-2 border-dashed rounded p-4 text-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setImage(e.target.files?.[0] || null)
              }
            />
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700"
          >
            Submit Site
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-gray-600">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
