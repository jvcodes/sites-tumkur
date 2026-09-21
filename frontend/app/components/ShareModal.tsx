"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import toast from "react-hot-toast";

export interface ShareSiteInfo {
  site_code: string;
  name?: string;
  location?: string;
  price?: number;
  area?: number;
  dimension?: string;
  image?: string;
  images?: string[];
  tuda_approved?: boolean;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  site: ShareSiteInfo | null;
}

export default function ShareModal({ isOpen, onClose, site }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset copied status when modal re-opens
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen || !site) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://tumkursites.com";
  const propertyUrl = `${origin}/site/${site.site_code}`;

  const formatPrice = (num?: number) => {
    if (!num) return "Price on Request";
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  const previewImage =
    site.image || (site.images && site.images.length > 0 ? site.images[0] : "/no-image.svg");

  const buildWhatsAppMessage = () => {
    const lines = [
      `🏡 *${site.name || "Prime Property in Tumkur"}*`,
      `📍 *Location:* ${site.location || "Tumkur"}`,
      `💰 *Price:* ${formatPrice(site.price)}`,
    ];

    if (site.dimension) {
      lines.push(`📐 *Dimensions:* ${site.dimension}`);
    } else if (site.area) {
      lines.push(`📐 *Area:* ${site.area} Sq.ft`);
    }

    if (site.tuda_approved) {
      lines.push(`✅ *TUDA Approved*`);
    }

    lines.push("");
    lines.push(`👉 *View full details, photo gallery & landmarks:*`);
    lines.push(propertyUrl);

    return encodeURIComponent(lines.join("\n"));
  };

  const handleWhatsAppShare = () => {
    const encodedText = buildWhatsAppMessage();
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    toast.success("Opening WhatsApp...");
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(propertyUrl);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement("textarea");
        textArea.value = propertyUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success("Property link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Could not copy automatically. Please copy the URL.");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: site.name || "SiteHub Tumkur Listing",
          text: `Check out this property in ${site.location || "Tumkur"} for ${formatPrice(site.price)}:`,
          url: propertyUrl,
        });
        toast.success("Shared successfully!");
        onClose();
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Native share error:", err);
        }
      }
    }
  };

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share Property"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">↗️</span>
            <h3 className="text-base font-bold text-gray-900">Share Property</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Property Preview Card */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-200">
            <Image
              src={previewImage}
              alt={site.name || "Site"}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized={previewImage.startsWith("http") || previewImage.startsWith("/no-image")}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-xs font-semibold text-gray-500">{site.site_code}</span>
              {site.tuda_approved && (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                  TUDA
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-gray-900 truncate">{site.name || "Site in " + site.location}</h4>
            <div className="flex items-center justify-between text-xs text-gray-600 mt-1">
              <span className="truncate">📍 {site.location || "Tumkur"}</span>
              <span className="font-bold text-red-600 ml-2 whitespace-nowrap">{formatPrice(site.price)}</span>
            </div>
          </div>
        </div>

        {/* Share Action Buttons */}
        <div className="p-5 space-y-3">
          {/* 1-Tap WhatsApp Share */}
          <button
            onClick={handleWhatsAppShare}
            data-testid="share-whatsapp-btn"
            className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all"
          >
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.07-1.115-.065-.262-.084-.596-.205-1.026-.393-1.815-.795-3.003-2.628-3.094-2.75-.091-.122-.743-.99-.743-1.889 0-.899.467-1.341.633-1.523.166-.182.364-.228.485-.228.122 0 .243.002.348.007.112.005.263-.042.411.314.152.365.517 1.262.562 1.354.045.091.076.198.015.32-.061.121-.091.198-.182.304-.091.106-.192.237-.274.318-.091.091-.186.19-.08.373.106.182.472.779 1.013 1.261.697.621 1.285.813 1.467.904.182.091.289.076.395-.046.106-.121.456-.532.577-.714.121-.182.243-.152.41-.091.167.061 1.062.501 1.244.592.182.091.304.137.349.213.045.076.045.441-.099.846zM12 2C6.477 2 2 6.477 2 12c0 1.891.524 3.662 1.435 5.176L2 22l4.954-1.399C8.406 21.494 10.149 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18.167c-1.632 0-3.149-.523-4.388-1.411l-.314-.225-2.946.832.846-2.871-.248-.344C4.016 14.887 3.5 13.486 3.5 12c0-4.687 3.813-8.5 8.5-8.5 4.687 0 8.5 3.813 8.5 8.5 0 4.687-3.813 8.667-8.5 8.667z" />
            </svg>
            <span>Share on WhatsApp</span>
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            data-testid="share-copy-link-btn"
            className={`w-full flex items-center justify-center gap-2.5 font-bold py-3.5 px-4 rounded-xl border transition-all ${
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm"
                : "bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-800 border-gray-200 shadow-sm"
            }`}
          >
            {copied ? (
              <>
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-emerald-700">Link Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy Property Link</span>
              </>
            )}
          </button>

          {/* Device Native Share ("More Options") */}
          {hasNativeShare && (
            <button
              onClick={handleNativeShare}
              data-testid="share-native-more-btn"
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 py-2 transition-colors"
            >
              <span>More sharing options (Telegram, Messages, etc.)</span>
              <span>→</span>
            </button>
          )}
        </div>

        {/* Modal Footer Note */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-500">
            Anyone with this link can view photos, dimensions, and TUDA approvals.
          </p>
        </div>
      </div>
    </div>
  );
}
