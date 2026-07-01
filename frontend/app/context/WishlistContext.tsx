"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

interface WishlistContextType {
    wishlist: string[]; // List of site_codes
    toggleWishlist: (site_code: string) => Promise<void>;
    isInWishlist: (site_code: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [wishlist, setWishlist] = useState<string[]>([]);

    // Fetch wishlist from server whenever user logs in
    useEffect(() => {
        if (user?.email) {
            fetchWishlist(user.email);
        } else {
            setWishlist([]);
        }
    }, [user]);

    const fetchWishlist = async (email: string) => {
        try {
            const res = await fetch(
                `/api/wishlist/?email=${encodeURIComponent(email)}`
            );
            if (res.ok) {
                const data = await res.json();
                // data is array of site objects — extract just the site_codes
                const codes = data
                    .map((site: any) => site.site_code)
                    .filter(Boolean);
                setWishlist(codes);
            }
        } catch (err) {
            console.error("Failed to fetch wishlist", err);
        }
    };

    const toggleWishlist = async (site_code: string) => {
        if (!user?.email) {
            alert("Please login to save sites to your wishlist!");
            return;
        }

        // Optimistic UI update
        const wasLiked = wishlist.includes(site_code);
        setWishlist((prev) =>
            wasLiked ? prev.filter((c) => c !== site_code) : [...prev, site_code]
        );

        try {
            const res = await fetch(`/api/wishlist/toggle/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email, site_code }),
            });

            if (!res.ok) {
                // Revert optimistic update on failure
                setWishlist((prev) =>
                    wasLiked ? [...prev, site_code] : prev.filter((c) => c !== site_code)
                );
                console.error("Wishlist toggle failed");
            }
        } catch (err) {
            // Revert on network error
            setWishlist((prev) =>
                wasLiked ? [...prev, site_code] : prev.filter((c) => c !== site_code)
            );
            console.error("Wishlist Toggle Error", err);
        }
    };

    const isInWishlist = (site_code: string) => wishlist.includes(site_code);

    return (
        <WishlistContext.Provider value={{ wishlist, toggleWishlist, isInWishlist }}>
            {children}
        </WishlistContext.Provider>
    );
}

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (context === undefined) {
        throw new Error("useWishlist must be used within a WishlistProvider");
    }
    return context;
};
