"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

interface ProfileData {
    name: string;
    email: string;
    phone: string;
    role: string;
    created_at: string;
}

export default function ProfilePage() {
    const { user, updateUser, logout } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [editingPhone, setEditingPhone] = useState(false);
    const [newPhone, setNewPhone] = useState("");
    const [phoneSaving, setPhoneSaving] = useState(false);
    const [phoneMsg, setPhoneMsg] = useState("");

    const [editingName, setEditingName] = useState(false);
    const [newName, setNewName] = useState("");
    
    const [editingEmail, setEditingEmail] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileMsg, setProfileMsg] = useState("");

    useEffect(() => {
        if (user?.email || user?.phone) {
            const queryParam = user?.email ? `email=${encodeURIComponent(user.email)}` : `phone=${encodeURIComponent(user.phone || "")}`;
            fetch(`/api/auth/profile/me?${queryParam}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) {
                        setProfile(data);
                        setNewPhone(data.phone || "");
                        setNewName(data.name || "");
                        setNewEmail(data.email || "");
                    }
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [user]);

    const savePhone = async () => {
        if (!user?.email) return;
        const digitsOnly = newPhone.replace(/\D/g, "");
        const clean = digitsOnly.slice(-10);
        if (!/^[6-9]\d{9}$/.test(clean) || digitsOnly.length < 10) {
            setPhoneMsg("⚠️ Enter a valid 10-digit Indian mobile number.");
            return;
        }
        setPhoneSaving(true);
        setPhoneMsg("");
        try {
            const res = await fetch("/api/auth/update-phone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email, phone: clean }),
            });
            const data = await res.json();
            if (res.ok) {
                setProfile(prev => prev ? { ...prev, phone: clean } : prev);
                setEditingPhone(false);
                setPhoneMsg("✅ Mobile number saved!");
            } else {
                setPhoneMsg(`❌ ${data.error || "Failed to save. Try again."}`);
            }
        } catch {
            setPhoneMsg("❌ Network error. Please try again.");
        } finally {
            setPhoneSaving(false);
        }
    };

    const saveProfile = async (field: "name" | "email") => {
        if (!user?.email && !user?.phone) return;
        setProfileSaving(true);
        setProfileMsg("");
        
        try {
            const res = await fetch("/api/auth/update-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    identifier: user.email || user.phone,
                    name: field === "name" ? newName : undefined,
                    email: field === "email" ? newEmail : undefined
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setProfile(prev => prev ? { 
                    ...prev, 
                    name: field === "name" ? newName : prev.name,
                    email: field === "email" ? newEmail : prev.email
                } : prev);
                
                // Update AuthContext so navbar reflects the change
                updateUser({
                    name: field === "name" ? newName : undefined,
                    email: field === "email" ? newEmail : undefined
                });
                
                if (field === "name") setEditingName(false);
                if (field === "email") setEditingEmail(false);
                
                setProfileMsg(`✅ ${field === "name" ? "Name" : "Email"} saved!`);
                setTimeout(() => setProfileMsg(""), 3000);
            } else {
                setProfileMsg(`❌ ${data.error || "Failed to save. Try again."}`);
            }
        } catch {
            setProfileMsg("❌ Network error. Please try again.");
        } finally {
            setProfileSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-500">Loading your profile...</div>;
    if (!profile) return <div className="p-8 text-red-500">Could not load profile. Please try again.</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">Personal Information</h1>

            {profileMsg && (
                <div className={`p-4 rounded-lg text-sm font-semibold mb-4 ${
                    profileMsg.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                    {profileMsg}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 max-w-2xl">
                {/* Full Name */}
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Full Name</label>
                    {editingName ? (
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Enter your full name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="flex-1 border rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                                autoFocus
                            />
                            <button
                                onClick={() => saveProfile("name")}
                                disabled={profileSaving}
                                className="bg-blue-600 text-white px-4 py-2.5 rounded font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                            >
                                {profileSaving ? "..." : "Save"}
                            </button>
                            <button
                                onClick={() => { setEditingName(false); setNewName(profile.name || ""); }}
                                className="px-4 py-2.5 rounded border text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 items-center border rounded px-3 py-2.5 bg-gray-50">
                            <span className="flex-1 text-gray-800 font-medium">
                                {profile.name || <span className="text-gray-400 italic">Not set</span>}
                            </span>
                            <button
                                onClick={() => setEditingName(true)}
                                className="text-blue-600 text-sm font-bold hover:underline"
                            >
                                Edit
                            </button>
                        </div>
                    )}
                </div>

                {/* Email */}
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Email Address</label>
                    {editingEmail ? (
                        <div className="flex gap-2 items-center">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="flex-1 border rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                                autoFocus
                            />
                            <button
                                onClick={() => saveProfile("email")}
                                disabled={profileSaving}
                                className="bg-blue-600 text-white px-4 py-2.5 rounded font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                            >
                                {profileSaving ? "..." : "Save"}
                            </button>
                            <button
                                onClick={() => { setEditingEmail(false); setNewEmail(profile.email || ""); }}
                                className="px-4 py-2.5 rounded border text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 items-center border rounded px-3 py-2.5 bg-gray-50">
                            <span className="flex-1 text-gray-800 font-medium">
                                {profile.email || <span className="text-gray-400 italic">Not added yet</span>}
                            </span>
                            <button
                                onClick={() => setEditingEmail(true)}
                                className="text-blue-600 text-sm font-bold hover:underline"
                            >
                                {profile.email ? "Edit" : "+ Add"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Phone — Inline Edit */}
                <div className="md:col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">
                        Mobile Number
                    </label>
                    {editingPhone ? (
                        <div className="flex gap-2 items-center">
                            <input
                                type="tel"
                                maxLength={10}
                                placeholder="10-digit mobile number"
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                className="flex-1 border rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
                                autoFocus
                            />
                            <button
                                onClick={savePhone}
                                disabled={phoneSaving}
                                className="bg-blue-600 text-white px-4 py-2.5 rounded font-bold text-sm hover:bg-blue-700 disabled:opacity-60"
                            >
                                {phoneSaving ? "Saving..." : "Save"}
                            </button>
                            <button
                                onClick={() => { setEditingPhone(false); setPhoneMsg(""); setNewPhone(profile.phone || ""); }}
                                className="px-4 py-2.5 rounded border text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2 items-center border rounded px-3 py-2.5 bg-gray-50">
                            <span className="flex-1 text-gray-800 font-medium">
                                {profile.phone || <span className="text-gray-400 italic">Not added yet</span>}
                            </span>
                            <button
                                onClick={() => setEditingPhone(true)}
                                className="text-blue-600 text-sm font-bold hover:underline"
                            >
                                {profile.phone ? "Edit" : "+ Add"}
                            </button>
                        </div>
                    )}
                    {phoneMsg && (
                        <p className="text-sm mt-1.5 font-medium text-gray-700">{phoneMsg}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                        Your mobile number is used to confirm site visit bookings.
                    </p>
                </div>

                {/* Role */}
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Account Type</label>
                    <div className="p-3 bg-gray-50 border rounded text-gray-800 font-medium flex gap-2 items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {profile.role}
                    </div>
                </div>
            </div>

            <div className="pt-8 mt-8 border-t flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <p className="text-sm text-gray-500">
                    Account created on {new Date(profile.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
                <button
                    onClick={() => {
                        logout();
                        router.push("/");
                    }}
                    className="flex items-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-6 py-2.5 rounded-lg font-bold transition-colors w-full md:w-auto justify-center"
                >
                    <span className="text-xl">🚪</span> Logout
                </button>
            </div>
        </div>
    );
}
