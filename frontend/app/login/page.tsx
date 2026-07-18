"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { loginWithPhone, loading } = useAuth();
    const router = useRouter();
    
    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [step, setStep] = useState<"PHONE" | "OTP">("PHONE");
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        // Initialize reCAPTCHA only when not loading so the container exists in the DOM
        if (!loading) {
            if ((window as any).recaptchaVerifier) {
                try {
                    (window as any).recaptchaVerifier.clear();
                } catch (e) {
                    console.error("Failed to clear reCAPTCHA", e);
                }
            }
            try {
                (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': () => {
                        // reCAPTCHA solved
                    },
                    'expired-callback': () => {
                        setError("reCAPTCHA expired. Please try again.");
                    }
                });
            } catch (e) {
                console.error("Failed to initialize reCAPTCHA", e);
            }
        }
    }, [loading]);

    const handleSendOTP = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            setError("Please enter a valid phone number (e.g. +91 9999999999)");
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            // Make sure the number has a country code, default to +91 for India if omitted
            const formattedNumber = phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`;
            
            const appVerifier = (window as any).recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, formattedNumber, appVerifier);
            setConfirmationResult(confirmation);
            setStep("OTP");
        } catch (err: any) {
            console.error("Error sending OTP", err);
            setError(err.message || "Failed to send OTP. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length < 6 || !confirmationResult) {
            setError("Please enter the 6-digit OTP");
            return;
        }

        setIsSubmitting(true);
        setError("");

        try {
            // Verify with Firebase
            const result = await confirmationResult.confirm(otp);
            const user = result.user;
            
            // Get the secure ID token
            const idToken = await user.getIdToken();
            
            // Send token to our Django backend
            await loginWithPhone(idToken);
            
            router.push("/");
        } catch (err: any) {
            console.error("Error verifying OTP", err);
            // Distinguish between Firebase invalid OTP and Backend connection error
            // (To make sure we don't hide backend deployment/database errors again)
            if (err.message === "Phone Login failed" || err.message?.includes("fetch") || err.message?.includes("network")) {
                setError("Server error: Failed to connect to backend database (Check deployment environment variables and MongoDB IP whitelist).");
            } else {
                setError("Invalid OTP code. Please check and try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
                <div className="flex justify-center"><div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></div></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            {/* Invisible reCAPTCHA container required by Firebase */}
            <div id="recaptcha-container"></div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center mb-6">
                    <Link href="/" className="text-3xl font-extrabold text-[var(--color-primary)] hover:opacity-90 transition-opacity">
                        TumkurSites
                    </Link>
                </div>
                <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                    Welcome Back
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    {step === "PHONE" ? "Enter your phone number to sign in or create an account." : "We've sent a 6-digit code to your phone."}
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium border border-red-100 flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            {error}
                        </div>
                    )}

                    {step === "PHONE" && (
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                                    Phone Number
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        placeholder="+91 9876543210"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleSendOTP()}
                                        className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-all disabled:opacity-70"
                            >
                                {isSubmitting ? "Sending OTP..." : "Get OTP"}
                            </button>
                        </div>
                    )}

                    {step === "OTP" && (
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                                    Enter OTP Code
                                </label>
                                <div className="mt-2">
                                    <input
                                        id="otp"
                                        name="otp"
                                        type="text"
                                        placeholder="123456"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        onKeyDown={e => e.key === "Enter" && handleVerifyOTP()}
                                        className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-center sm:text-2xl tracking-widest transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center gap-3 mt-4">
                                <button 
                                    onClick={handleVerifyOTP}
                                    disabled={isSubmitting}
                                    className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] transition-all disabled:opacity-70"
                                >
                                    {isSubmitting ? "Verifying..." : "Verify & Sign In"}
                                </button>
                                
                                <div className="text-center w-full flex justify-between px-2">
                                    <button 
                                        onClick={() => setStep("PHONE")} 
                                        className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition"
                                    >
                                        Change Number
                                    </button>
                                    
                                    <ResendButton onResend={handleSendOTP} isSubmitting={isSubmitting} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <p className="mt-8 text-center text-xs text-gray-500 max-w-xs mx-auto">
                    By continuing, you agree to TumkurSites's Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    );
}

function ResendButton({ onResend, isSubmitting }: { onResend: () => void, isSubmitting: boolean }) {
    const [timeLeft, setTimeLeft] = useState(30);

    useEffect(() => {
        if (timeLeft <= 0) return;
        const timerId = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(timerId);
    }, [timeLeft]);

    return (
        <button 
            onClick={() => {
                if (timeLeft <= 0) {
                    setTimeLeft(30);
                    onResend();
                }
            }}
            disabled={timeLeft > 0 || isSubmitting}
            className={`text-sm font-semibold transition ${timeLeft > 0 ? "text-gray-400 cursor-not-allowed" : "text-[var(--color-accent)] hover:underline"}`}
        >
            {timeLeft > 0 ? `Resend OTP in ${timeLeft}s` : "Resend OTP"}
        </button>
    );
}
