"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
                <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center border border-gray-100">
                    <div className="text-5xl mb-4">👤</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Login Required</h2>
                    <p className="text-gray-500 mb-6">
                        Please <a href="/login" className="text-blue-600 font-semibold hover:underline">log in</a> to view your profile, bookings, and uploaded sites.
                    </p>
                    <a
                        href="/login"
                        className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md"
                    >
                        Login with Google
                    </a>
                </div>
            </div>
        );
    }


    const menuItems = [
        { name: "My Profile", path: "/profile", icon: "👤" },
        { name: "My Visits", path: "/profile/visits", icon: "👁️" },
        { name: "Booked for Visit", path: "/profile/booked", icon: "📅" },
        { name: "My Uploaded Sites", path: "/profile/my-sites", icon: "🏠" },
    ];

    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">

                {/* SIDEBAR FOR PROFILE */}
                <div className="space-y-6">
                    {/* User Brief */}
                    <div className="bg-white p-5 rounded-lg shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
                            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Hello,</p>
                            <h2 className="text-lg font-bold text-gray-800">{user.name}</h2>
                        </div>
                    </div>

                    {/* Navigation Menu */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden text-sm">
                        <ul className="divide-y divide-gray-100">
                            {menuItems.map((item) => {
                                const isActive = pathname === item.path;
                                return (
                                    <li key={item.path}>
                                        <Link
                                            href={item.path}
                                            className={`flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors ${isActive ? "text-blue-600 bg-blue-50/50 font-semibold border-l-4 border-blue-600" : "text-gray-700 font-medium border-l-4 border-transparent"
                                                }`}
                                        >
                                            <span className="text-lg opacity-80">{item.icon}</span>
                                            {item.name}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="bg-white rounded-lg shadow-sm p-6 overflow-hidden">
                    {children}
                </div>
            </div>
        </div>
    );
}
