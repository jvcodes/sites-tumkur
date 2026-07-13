"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface User {
    id: number;
    name: string;
    email: string;
    phone?: string;
    role?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, name: string) => Promise<void>;
    loginWithPhone: (idToken: string) => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check localStorage on mount
        const storedToken = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email: string, name: string) => {
        try {
            const res = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name }),
            });

            if (!res.ok) throw new Error("Login failed");

            const data = await res.json();

            // Save state
            setToken(data.token);
            setUser(data.user);

            // Persist
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            router.push("/");
        } catch (error) {
            console.error("Login Error:", error);
            toast.error("Login Failed");
        }
    };

    const loginWithPhone = async (idToken: string) => {
        try {
            const res = await fetch("/api/auth/phone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            });

            if (!res.ok) throw new Error("Phone Login failed");

            const data = await res.json();

            // Save state
            setToken(data.token);
            setUser(data.user);

            // Persist
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            router.push("/");
        } catch (error) {
            console.error("Phone Login Error:", error);
            toast.error("Phone Login Failed");
            throw error;
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/login"); // Redirect to login after logout
    };

    const updateUser = (updates: Partial<User>) => {
        if (!user) return;
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
        const updated = { ...user, ...cleanUpdates };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
    };

    return (
        <AuthContext.Provider value={{ user, token, login, loginWithPhone, updateUser, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
