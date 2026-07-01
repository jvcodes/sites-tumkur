"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Link from "next/link";

export default function BookedVisitsPage() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.email) {
            fetch(`http://127.0.0.1:8000/api/bookings/me/?email=${encodeURIComponent(user.email)}`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setBookings(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [user]);

    if (loading) return <div className="p-8 text-gray-500">Loading your booked visits...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">Booked for Visit</h1>

            {bookings.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded border border-dashed mt-8">
                    <p className="text-gray-500 mb-4">You have not booked any site visits yet.</p>
                    <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">
                        Explore Properties
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {bookings.map((booking, index) => (
                        <div key={booking.id || index} className="bg-white border rounded-xl shadow-sm p-6 relative">
                            {/* Status logic */}
                            <div className={`absolute top-4 right-4 px-3 py-1 rounded text-xs font-bold uppercase tracking-wide 
                                ${booking.status === 'approved' ? 'bg-green-100 text-green-700' 
                                : booking.status === 'completed' ? 'bg-blue-100 text-blue-700'
                                : booking.status === 'rejected' ? 'bg-red-100 text-red-700'
                                : 'bg-orange-100 text-orange-700'}`}>
                                {booking.status || 'Pending'}
                            </div>

                            <div className="mb-4">
                                <h3 className="text-lg font-bold text-gray-800">
                                    Visit Scheduled: {new Date(booking.date).toLocaleDateString()} 
                                    {booking.time && <span className="text-blue-600 ml-2">@ {booking.time}</span>}
                                </h3>
                                <p className="text-sm text-gray-500">Booked on {new Date(booking.created_at).toLocaleDateString()}</p>
                            </div>
                            
                            {booking.broker_name && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                                        {booking.broker_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-blue-900">Agent: {booking.broker_name}</p>
                                        <p className="text-xs text-blue-600">Will contact you to confirm the visit time.</p>
                                    </div>
                                </div>
                            )}

                            <h4 className="font-semibold text-gray-700 mb-2">Sites to view:</h4>
                            <div className="grid gap-3">
                                {booking.sites && booking.sites.map((site: any, idx: number) => (
                                    <div key={idx} className="flex gap-4 items-center bg-gray-50 p-3 rounded border">
                                        <div className="w-16 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                            <img src={site.image || '/no-image.svg'} alt={site.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-800">{site.name}</p>
                                            <p className="text-xs text-gray-500">{site.location}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Price</p>
                                            <p className="font-semibold text-red-600">₹{site.price?.toLocaleString()}</p>
                                        </div>
                                        <Link href={`/site/${site.site_code}`} className="text-xs font-bold text-blue-600 hover:underline">
                                           View
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
