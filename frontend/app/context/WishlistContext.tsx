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
    const { user, token } = useAuth();
    const [wishlist, setWishlist] = useState<string[]>([]);

    // 1. Fetch Wishlist on Load/Login
    useEffect(() => {
        if (user && token) {
            fetchWishlist();
        } else {
            setWishlist([]);
        }
    }, [user, token]);

    const fetchWishlist = async () => {
        try {
            const res = await fetch("http://localhost:3000/api/wishlist/", {
                headers: { Authorization: `Token ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                // Extract site_codes for easy checking
                const codes = data.map((site: any) => site.site_code);
                setWishlist(codes);
            }
        } catch (err) {
            console.error("Failed to fetch wishlist", err);
        }
    };

    // 2. Toggle Logic
    const toggleWishlist = async (site_code: string) => {
        if (!user) {
            alert("Please login to add to wishlist!");
            return; // Could redirect to login here
        }

        try {
            // Optimistic Update
            const isLiked = wishlist.includes(site_code);
            setWishlist((prev) =>
                isLiked ? prev.filter(c => c !== site_code) : [...prev, site_code]
            );

            const res = await fetch("http://localhost:3000/api/wishlist/toggle", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Token ${token}`,
                },
                body: JSON.stringify({ site_code }),
            });

            if (!res.ok) {
                // Revert on failure
                fetchWishlist();
                alert("Failed to update wishlist");
            }
        } catch (err) {
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
