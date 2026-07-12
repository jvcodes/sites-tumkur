"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";

export default function MyVisitsPage() {
    const { user, loading: authLoading } = useAuth();
    const [visits, setVisits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        const identifier = user?.email || user?.phone || "";
        if (identifier) {
            const queryParam = `user_id=${encodeURIComponent(identifier)}`;
            fetch(`/api/sites/visits/me?${queryParam}`)
                .then(res => res.json())
                .then(data => {
                    setVisits(data);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [user, authLoading]);

    if (loading) return <div className="p-8 text-gray-500">Loading visit history...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">My Viewed Sites</h1>

            {visits.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded border border-dashed">
                    <p className="text-gray-500 mb-4">You haven't checked out any specific sites yet.</p>
                    <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">
                        Browse Properties
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4">
                    {visits.map((site, i) => (
                        <div key={i} className="flex gap-4 border rounded-xl p-4 hover:shadow-md transition-shadow bg-white items-center">
                            <div className="w-32 h-24 rounded bg-gray-100 flex-shrink-0 overflow-hidden relative">
                                <img src={site.image || '/no-image.svg'} className="w-full h-full object-cover" alt="Site" />
                            </div>

                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg">{site.name || "Real Estate Plot"}</h3>
                                        <p className="text-gray-500 text-sm">📍 {site.location}</p>
                                    </div>
                                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">
                                        {site.site_code}
                                    </span>
                                </div>

                                <div className="flex gap-4 mt-3 text-sm">
                                    <div className="flex items-center gap-1">
                                        <span className="text-gray-400 font-medium">Last Viewed:</span>
                                        <span className="text-gray-800 font-semibold">{new Date(site.visit_date).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-gray-400 font-medium">Status:</span>
                                        <span className={`font-semibold ${site.status === 'approved' || site.status === 'active' ? 'text-green-600' : 'text-orange-600'}`}>
                                            {site.status.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 pl-4 border-l">
                                <p className="font-extrabold text-lg text-red-600">₹{site.price.toLocaleString()}</p>
                                <Link
                                    href={`/site/${site.site_code}`}
                                    className="text-center bg-white border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white px-4 py-1.5 rounded text-sm font-bold transition-colors"
                                >
                                    View Again
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
