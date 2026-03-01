"use client";

import { useAuth } from "../../context/AuthContext";
import Link from "next/link";

export default function BookedVisitsPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 border-b pb-4">Booked for Visit</h1>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">Visit Management update</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                            <p>Booking histories are currently being migrated to your personalized dashboard. If you've scheduled a physical site evaluation, our agents will be in touch with you shortly at your registered phone number.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center py-10 bg-gray-50 rounded border border-dashed mt-8">
                <p className="text-gray-500 mb-4">Ready to schedule a new visit?</p>
                <Link href="/" className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700">
                    Explore Properties
                </Link>
            </div>
        </div>
    );
}
