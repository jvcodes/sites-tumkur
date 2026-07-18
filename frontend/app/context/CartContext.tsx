"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

export interface CartItem {
  site_code: string;
  name: string;
  location: string;
  price: number;
  image?: string;
  images?: string[];
  latitude?: number;
  longitude?: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (site_code: string) => void;
  clearCart: () => void;
  isInCart: (site_code: string) => boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper to deduplicate cart items by site_code
  const deduplicate = (items: CartItem[]) => {
    return Array.from(new Map(items.map((item) => [item.site_code, item])).values());
  };

  const saveCartLocally = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("cart", JSON.stringify(newCart));
  };

  const syncCartToBackend = async (cartToSync: CartItem[], userId: string) => {
    try {
      await fetch("/api/cart/sync/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          cart: cartToSync,
        }),
      });
    } catch (error) {
      console.error("Failed to sync cart to backend:", error);
    }
  };

  // Load and merge logic
  useEffect(() => {
    const loadAndMergeCart = async () => {
      // 1. Read local cart
      const localRaw = localStorage.getItem("cart");
      let localCart: CartItem[] = localRaw ? JSON.parse(localRaw) : [];

      if (!user) {
        // Just use local cart if not logged in
        setCart(localCart);
        setIsInitialized(true);
        return;
      }

      // 2. User is logged in, fetch backend cart
      try {
        const res = await fetch(`/api/cart/?user_id=${user.phone || user.email}`);
        if (res.ok) {
          const dbCart = await res.json();
          // dbCart contains full site objects, we need to map them back to CartItem
          const formattedDbCart: CartItem[] = dbCart.map((site: any) => ({
            site_code: site.site_code,
            name: site.name,
            location: site.location?.name || "Unknown Location",
            price: Number(site.price),
            image: site.images?.[0] || "/no-image.svg",
            images: site.images,
            latitude: site.location?.latitude,
            longitude: site.location?.longitude,
          }));

          // 3. Merge local and DB cart
          const merged = deduplicate([...formattedDbCart, ...localCart]);
          
          // 4. Update React state and local storage
          saveCartLocally(merged);
          
          // 5. Sync the newly merged cart back to the DB so the DB knows about the local items
          syncCartToBackend(merged, user.phone || user.email);
        }
      } catch (error) {
        console.error("Failed to fetch cart from backend:", error);
        // Fallback to local
        setCart(localCart);
      } finally {
        setIsInitialized(true);
      }
    };

    loadAndMergeCart();
  }, [user]);

  // Actions
  const addToCart = (item: CartItem) => {
    const newCart = deduplicate([...cart, item]);
    saveCartLocally(newCart);
    if (user) syncCartToBackend(newCart, user.phone || user.email);
  };

  const removeFromCart = (site_code: string) => {
    const newCart = cart.filter((item) => item.site_code !== site_code);
    saveCartLocally(newCart);
    if (user) syncCartToBackend(newCart, user.phone || user.email);
  };

  const clearCart = () => {
    saveCartLocally([]);
    if (user) syncCartToBackend([], user.phone || user.email);
  };

  const isInCart = (site_code: string) => {
    return cart.some((item) => item.site_code === site_code);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, isInCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
