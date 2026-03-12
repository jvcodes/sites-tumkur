"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

interface ProfileData {
    name: string;
    email: string;
    phone: string;
    role: string;
    created_at: string;
}

export default function ProfilePage() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.email) {
            fetch(`http://127.0.0.1:8000/api/auth/profile/me/?email=${encodeURIComponent(user.email)}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setProfile(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }
    }, [user]);

    if (loading) return <div className="p-8 text-gray-500">Loading profile details...</div>;
    if (!profile) return <div className="p-8 text-red-500">Failed to load profile details.</div>;

    return (
        <div className="space-y-8">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">Personal Information</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 max-w-2xl">
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Full Name</label>
                    <div className="p-3 bg-gray-50 border rounded text-gray-800 font-medium">
                        {profile.name}
                    </div>
                </div>

                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Email Address</label>
                    <div className="p-3 bg-gray-50 border rounded text-gray-800 font-medium">
                        {profile.email}
                    </div>
                </div>

                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">Phone Number</label>
                    <div className="p-3 bg-gray-50 border rounded text-gray-800 font-medium flex justify-between items-center group">
                        {profile.phone || <span className="text-gray-400 italic">Not provided</span>}
                        <button className="text-blue-500 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">User Role</label>
                    <div className="p-3 bg-gray-50 border rounded text-gray-800 font-medium flex gap-2 items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {profile.role}
                    </div>
                </div>
            </div>

            <div className="pt-8 mt-8 border-t">
                <p className="text-sm text-gray-500">Account created on {new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
        </div>
    );
}
