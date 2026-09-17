"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";

interface ReelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sitesWithVideos: any[];
  initialSiteId?: string;
}

/**
 * Robust clipboard helper:
 * Supports modern navigator.clipboard (in secure contexts) with seamless fallback
 * to document.execCommand('copy') via a temporary DOM element.
 * Guarantees link copying works across desktop, Android Chrome, iOS Safari,
 * WebViews, and local HTTP LAN testing (e.g., http://192.168.1.4:3000).
 */
async function copyToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard failed, trying fallback:", err);
    }
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("document.execCommand fallback failed:", err);
    return false;
  }
}

/**
 * Robust YouTube video ID parser:
 * Handles youtube.com/watch?v=, youtu.be/, youtube.com/embed/, and youtube.com/shorts/
 */
function getYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function formatPrice(price: number): string {
  if (!price && price !== 0) return "Price on Request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function shortPrice(price: number): string {
  if (!price) return "N/A";
  if (price >= 10000000) {
    return `${(price / 10000000).toFixed(2)} Cr`;
  }
  if (price >= 100000) {
    return `${(price / 100000).toFixed(1)} Lakh`;
  }
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function ReelsModal({
  isOpen,
  onClose,
  sitesWithVideos,
  initialSiteId,
}: ReelsModalProps) {
  const { isInWishlist, toggleWishlist, wishlist } = useWishlist();
  const { addToCart, isInCart } = useCart();

  // Responsive device check: Ensures ONLY ONE iframe is ever mounted in DOM at a time
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      if (typeof window !== "undefined") {
        setIsDesktop(window.innerWidth >= 1024);
      }
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Modal State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedTab, setFeedTab] = useState<"all" | "saved">("all");
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Touch Drag Physics State for mobile
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // References
  const desktopIframeRef = useRef<HTMLIFrameElement | null>(null);
  const mobileIframeRef = useRef<HTMLIFrameElement | null>(null);
  const playlistRef = useRef<HTMLDivElement | null>(null);

  // Gesture tracking
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);
  const touchStartTime = useRef<number>(0);
  const isVerticalSwipe = useRef<boolean | null>(null);

  // Keep latest onClose reference for history listener
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Derive wishlist-only video tours
  const savedSitesWithVideos = useMemo(() => {
    const wishlistIds = new Set(wishlist);
    return sitesWithVideos.filter((s) => {
      const id = s.site_code || s.id_str || s._id;
      return wishlistIds.has(id);
    });
  }, [sitesWithVideos, wishlist]);

  // Current active playlist based on selected tab
  const activeSites = feedTab === "saved" ? savedSitesWithVideos : sitesWithVideos;
  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, activeSites.length - 1));

  // ── STOP CURRENT VIDEO HELPER ──
  // Immediately sends pause & stop commands to the active iframe so no residual audio continues
  const stopCurrentVideo = useCallback(() => {
    const activeIframe = isDesktop ? desktopIframeRef.current : mobileIframeRef.current;
    if (activeIframe?.contentWindow) {
      try {
        activeIframe.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "stopVideo", args: "" }),
          "*"
        );
        activeIframe.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: "" }),
          "*"
        );
      } catch (err) {
        // Suppress any cross-origin notification issues
      }
    }
  }, [isDesktop]);

  // Safe Close Helper
  const handleSafeClose = useCallback(() => {
    stopCurrentVideo();
    onClose();
  }, [stopCurrentVideo, onClose]);

  // Navigation Helpers
  const goToNext = useCallback(() => {
    if (safeIndex < activeSites.length - 1) {
      stopCurrentVideo();
      setCurrentIndex((prev) => prev + 1);
    }
  }, [safeIndex, activeSites.length, stopCurrentVideo]);

  const goToPrev = useCallback(() => {
    if (safeIndex > 0) {
      stopCurrentVideo();
      setCurrentIndex((prev) => prev - 1);
    }
  }, [safeIndex, stopCurrentVideo]);

  const handleSelectIndex = useCallback(
    (idx: number) => {
      if (idx !== safeIndex) {
        stopCurrentVideo();
        setCurrentIndex(idx);
      }
    },
    [safeIndex, stopCurrentVideo]
  );

  // ── DEVICE / BROWSER HARDWARE BACK BUTTON (POPSTATE) INTEGRATION ──
  useEffect(() => {
    if (!isOpen) return;

    let didPush = false;
    if (typeof window !== "undefined") {
      window.history.pushState({ sitehub_modal: "reels" }, "");
      didPush = true;
    }

    const handlePopState = () => {
      stopCurrentVideo();
      onCloseRef.current();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (
        didPush &&
        typeof window !== "undefined" &&
        window.history.state?.sitehub_modal === "reels"
      ) {
        window.history.back();
      }
    };
  }, [isOpen, stopCurrentVideo]);

  // Reset drag/pause when index changes
  useEffect(() => {
    setIsPaused(false);
    setDragOffsetY(0);
  }, [safeIndex]);

  // Sync initial site ID if provided when modal opens
  useEffect(() => {
    if (isOpen && initialSiteId && activeSites.length > 0) {
      const foundIdx = activeSites.findIndex(
        (s) => (s.site_code || s.id_str || s._id) === initialSiteId
      );
      if (foundIdx !== -1) {
        setCurrentIndex(foundIdx);
      } else {
        setCurrentIndex(0);
      }
    }
  }, [isOpen, initialSiteId, activeSites]);

  // Scroll active playlist item into view on desktop
  useEffect(() => {
    if (isOpen && playlistRef.current) {
      const activeItem = playlistRef.current.querySelector(
        `[data-site-idx="${safeIndex}"]`
      );
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [safeIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        if (isShareSheetOpen) {
          setIsShareSheetOpen(false);
        } else {
          handleSafeClose();
        }
      } else if (
        e.key === "ArrowDown" ||
        e.key === "ArrowRight" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        goToNext();
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "PageUp"
      ) {
        e.preventDefault();
        goToPrev();
      }
    },
    [isOpen, isShareSheetOpen, goToNext, goToPrev, handleSafeClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSite = activeSites[safeIndex];
  const displayId = currentSite
    ? currentSite.site_code || currentSite.id_str || currentSite._id || ""
    : "";
  const youtubeId = currentSite
    ? getYoutubeVideoId(currentSite.youtube_url)
    : null;
  const isLiked = displayId ? isInWishlist(displayId) : false;
  const inVisitList = displayId ? isInCart(displayId) : false;

  // Toggle Play / Pause via YouTube Iframe API postMessage
  const togglePlayPause = () => {
    const targetIframe = isDesktop ? desktopIframeRef.current : mobileIframeRef.current;
    if (!targetIframe?.contentWindow) return;
    const cmd = isPaused ? "playVideo" : "pauseVideo";
    targetIframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: cmd, args: "" }),
      "*"
    );
    setIsPaused((prev) => !prev);
  };

  // ── TOUCH GESTURE PHYSICS ENGINE (TikTok / Instagram Reels fluid swipe) ──
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    isVerticalSwipe.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    touchCurrentY.current = currentY;
    const diffY = currentY - touchStartY.current;
    const diffX = currentX - touchStartX.current;

    // Lock direction after minimal movement threshold
    if (isVerticalSwipe.current === null) {
      if (Math.abs(diffY) > 5 || Math.abs(diffX) > 5) {
        isVerticalSwipe.current = Math.abs(diffY) > Math.abs(diffX);
      }
    }

    // Only apply vertical drag if direction is predominantly vertical
    if (isVerticalSwipe.current) {
      if (
        (safeIndex === 0 && diffY > 0) ||
        (safeIndex === activeSites.length - 1 && diffY < 0)
      ) {
        setDragOffsetY(diffY * 0.25);
      } else {
        setDragOffsetY(diffY);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches?.[0]?.clientY ?? touchCurrentY.current ?? touchStartY.current;
    const diffY = endY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = Math.abs(diffY) / Math.max(elapsed, 1);

    // Intentional swipe detection
    const isIntentionalSwipe =
      Math.abs(diffY) > 40 ||
      (velocity > 0.3 && Math.abs(diffY) > 18);

    if (isIntentionalSwipe && (isVerticalSwipe.current ?? true)) {
      if (diffY < 0 && safeIndex < activeSites.length - 1) {
        goToNext(); // Dragged Up -> Next Video
      } else if (diffY > 0 && safeIndex > 0) {
        goToPrev(); // Dragged Down -> Previous Video
      }
    }

    // Reset touch tracking
    setIsDragging(false);
    setDragOffsetY(0);
    touchStartY.current = null;
    touchStartX.current = null;
    touchCurrentY.current = null;
    isVerticalSwipe.current = null;
  };

  const handleAddVisit = () => {
    if (!currentSite || inVisitList) return;
    addToCart({
      site_code: displayId,
      name: currentSite.name,
      location: currentSite.location,
      price: currentSite.price,
      image: currentSite.images?.[0] || currentSite.image || "/no-image.svg",
      images: currentSite.images,
      latitude: currentSite.latitude,
      longitude: currentSite.longitude,
      area: currentSite.area,
      dimension: currentSite.dimension,
      facing: currentSite.facing,
    });
    toast.success("Added to Visit Schedule!");
  };

  // ── BULLETPROOF SHARE ACTION ──
  const handleOpenShare = async () => {
    if (!currentSite) return;
    const url = `${window.location.origin}/site/${displayId}`;
    const shareText = `Check out this property tour in ${currentSite.location} for ${shortPrice(currentSite.price)} on SiteHub Tumkur:`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: currentSite.name || "Tumkur Property Video Tour",
          text: shareText,
          url: url,
        });
        toast.success("Shared successfully!");
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.warn("navigator.share failed, opening fallback share sheet:", err);
      }
    }

    setIsShareSheetOpen(true);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/site/${displayId}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.success("Property link copied to clipboard!");
    } else {
      toast.error("Could not copy link automatically. Please copy the URL manually.");
    }
  };

  const handleWhatsAppShare = () => {
    if (!currentSite) return;
    const url = `${window.location.origin}/site/${displayId}`;
    const text = encodeURIComponent(
      `🏡 *${currentSite.name || "Property in " + currentSite.location}*
` +
      `📍 Location: ${currentSite.location}
` +
      `💰 Price: ${shortPrice(currentSite.price)}
` +
      (currentSite.area ? `📐 Area: ${currentSite.area} Sq.ft
` : "") +
      `🎥 Watch Video Tour: ${url}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  // YouTube embed URL:
  // - autoplay=1&mute=1: complies with browser autoplay policy for automatic scroll playback
  // - controls=1: provides native YouTube controls (play/pause, volume slider, mute/unmute)
  // - enablejsapi=1: enables sending stopVideo commands on navigation
  const embedUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&controls=1&rel=0&playsinline=1&enablejsapi=1`
    : null;

  return (
    <div
      data-testid="reels-modal"
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-0 md:p-4 select-none animate-fade-in"
    >
      {/* ────────────────────────────────────────────────────────── */}
      {/* 🖥️ DESKTOP WIDESCREEN THEATER VIEW (Rendered ONLY on >= 1024px) */}
      {/* ────────────────────────────────────────────────────────── */}
      {isDesktop ? (
        <div className="flex flex-col w-full max-w-6xl h-[88vh] bg-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Desktop Header */}
          <div className="px-6 py-3.5 bg-gray-900 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <h1 className="font-bold text-white text-base tracking-wide flex items-center gap-2">
                <span>🎬</span> Tumkur Property Tours
              </h1>

              {/* Segmented Filter Switch */}
              <div className="flex items-center bg-white/10 p-0.5 rounded-lg border border-white/10 ml-2">
                <button
                  onClick={() => {
                    stopCurrentVideo();
                    setFeedTab("all");
                    setCurrentIndex(0);
                  }}
                  data-testid="reels-tab-all"
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    feedTab === "all"
                      ? "bg-blue-600 text-white shadow"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  All Tours ({sitesWithVideos.length})
                </button>
                <button
                  onClick={() => {
                    stopCurrentVideo();
                    setFeedTab("saved");
                    setCurrentIndex(0);
                  }}
                  data-testid="reels-tab-saved"
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    feedTab === "saved"
                      ? "bg-red-600 text-white shadow"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <span>❤️ Saved Tours</span>
                  <span className="text-[11px] opacity-80">
                    ({savedSitesWithVideos.length})
                  </span>
                </button>
              </div>

              {activeSites.length > 0 && (
                <span className="text-xs text-gray-400 bg-white/10 px-2.5 py-0.5 rounded-full font-mono">
                  {safeIndex + 1} of {activeSites.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Prev / Next buttons */}
              <button
                onClick={goToPrev}
                disabled={safeIndex === 0 || activeSites.length === 0}
                className={`p-2 rounded-lg border border-white/15 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                  safeIndex === 0 || activeSites.length === 0
                    ? "opacity-30 cursor-not-allowed"
                    : "hover:bg-white/10"
                }`}
                title="Previous property video (Left/Up arrow)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Prev</span>
              </button>

              <button
                onClick={goToNext}
                disabled={safeIndex >= activeSites.length - 1 || activeSites.length === 0}
                className={`p-2 rounded-lg border border-white/15 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                  safeIndex >= activeSites.length - 1 || activeSites.length === 0
                    ? "opacity-30 cursor-not-allowed"
                    : "hover:bg-white/10"
                }`}
                title="Next property video (Right/Down arrow)"
              >
                <span>Next</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Prominent Back / Close Button */}
              <button
                onClick={handleSafeClose}
                data-testid="reels-close-desktop"
                aria-label="Back to browse"
                className="ml-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
                title="Back to Browse (ESC)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Exit</span>
              </button>
            </div>
          </div>

          {/* Empty State for Saved Tours */}
          {activeSites.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-950 text-white">
              <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-3xl mb-4">
                ❤️
              </div>
              <h3 className="text-xl font-bold mb-2">No Saved Video Tours Yet</h3>
              <p className="text-gray-400 text-sm max-w-md mb-6">
                When you find a property you like, tap the ❤️ Save button to add its video tour to your personal collection.
              </p>
              <button
                onClick={() => {
                  stopCurrentVideo();
                  setFeedTab("all");
                  setCurrentIndex(0);
                }}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg transition-transform active:scale-95"
              >
                Browse All Video Tours ({sitesWithVideos.length})
              </button>
            </div>
          ) : (
            /* Desktop Split-Screen: Widescreen Video (Left) + Property Specs & Playlist (Right) */
            <div className="flex-1 grid grid-cols-[1fr_390px] min-h-0 overflow-hidden">
              {/* Left: 16:9 Landscape Cinema Player */}
              <div className="relative bg-black flex items-center justify-center overflow-hidden h-full">
                {/* Zero-Flicker Backdrop Poster: Renders immediately while YouTube buffers */}
                {youtubeId && (
                  <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
                    <img
                      src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover opacity-60 filter blur-[1px] scale-105"
                    />
                  </div>
                )}

                {embedUrl ? (
                  <iframe
                    ref={desktopIframeRef}
                    key={`yt-player-desktop-${safeIndex}-${youtubeId}`}
                    src={embedUrl}
                    className="w-full h-full border-none relative z-10"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={currentSite?.name || "Property Video"}
                  />
                ) : (
                  <div className="relative z-10 text-gray-400 text-sm">No video available for this site.</div>
                )}
              </div>

              {/* Right: Property Details & Video Playlist */}
              <div className="bg-gray-900/95 border-l border-white/10 flex flex-col h-full overflow-hidden">
                {/* Active Property Card Details */}
                {currentSite && (
                  <div className="p-5 border-b border-white/10 bg-gray-900">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                        📍 {currentSite.location}
                      </span>
                      <span className="text-xs text-gray-300 bg-white/10 px-2 py-0.5 rounded-md font-mono">
                        ID: {displayId}
                      </span>
                      {currentSite.is_layout && currentSite.layout_name && (
                        <span className="text-xs text-amber-300 bg-amber-900/40 border border-amber-500/30 px-2 py-0.5 rounded-md font-medium">
                          🏡 {currentSite.layout_name}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold text-white line-clamp-1 mb-1.5">
                      {currentSite.name}
                    </h2>

                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-black text-amber-400">
                        {formatPrice(currentSite.price)}
                      </span>
                      <span className="text-xs font-bold text-gray-300 bg-white/15 px-2 py-0.5 rounded">
                        {shortPrice(currentSite.price)}
                      </span>
                    </div>

                    {/* Specs Pills */}
                    <div className="flex flex-wrap gap-2 text-xs text-gray-300 mb-4">
                      {currentSite.area && (
                        <span className="bg-white/10 px-2.5 py-1 rounded-md">
                          📐 {currentSite.area} Sq.ft
                        </span>
                      )}
                      {currentSite.dimension && (
                        <span className="bg-white/10 px-2.5 py-1 rounded-md">
                          📏 {currentSite.dimension}
                        </span>
                      )}
                      {currentSite.facing && (
                        <span className="bg-white/10 px-2.5 py-1 rounded-md">
                          🧭 {currentSite.facing} Facing
                        </span>
                      )}
                    </div>

                    {/* CTA Action Buttons */}
                    <div className="space-y-2">
                      <button
                        onClick={handleAddVisit}
                        disabled={inVisitList}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                          inVisitList
                            ? "bg-white/20 text-gray-300 cursor-default"
                            : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] text-white active:scale-95"
                        }`}
                      >
                        <span>
                          {inVisitList
                            ? "✓ Scheduled for Visit"
                            : "📅 Schedule Free Site Visit"}
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleWishlist(displayId)}
                          data-testid="reels-like-button"
                          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                            isLiked
                              ? "bg-red-500/20 text-red-400 border-red-500/40"
                              : "bg-white/5 hover:bg-white/10 text-gray-300 border-white/15"
                          }`}
                        >
                          <span>{isLiked ? "❤️ Saved" : "🤍 Save"}</span>
                        </button>

                        <button
                          onClick={handleOpenShare}
                          data-testid="reels-share-button-desktop"
                          className="flex-1 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/15 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>↗️ Share</span>
                        </button>

                        <Link
                          href={`/site/${displayId}`}
                          onClick={handleSafeClose}
                          className="py-2 px-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 text-center transition-colors"
                        >
                          Details &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {/* Property Tour Queue (Desktop Scrollable Playlist) */}
                <div className="flex-1 flex flex-col min-h-0 bg-gray-950/50">
                  <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between text-xs text-gray-400 font-semibold uppercase tracking-wider">
                    <span>Tour Queue</span>
                    <span>{activeSites.length} videos</span>
                  </div>

                  <div
                    ref={playlistRef}
                    className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar"
                  >
                    {activeSites.map((site, idx) => {
                      const sId = site.site_code || site.id_str || site._id;
                      const sYt = getYoutubeVideoId(site.youtube_url);
                      const isSelected = idx === safeIndex;

                      return (
                        <button
                          key={sId || idx}
                          data-site-idx={idx}
                          onClick={() => handleSelectIndex(idx)}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center gap-3 transition-all ${
                            isSelected
                              ? "bg-blue-600/20 border border-blue-500/50 shadow"
                              : "bg-white/5 hover:bg-white/10 border border-transparent"
                          }`}
                        >
                          {/* Video Thumbnail */}
                          <div className="w-16 h-11 rounded-lg bg-black overflow-hidden flex-shrink-0 relative border border-white/10">
                            {sYt ? (
                              <img
                                src={`https://img.youtube.com/vi/${sYt}/default.jpg`}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                🎬
                              </div>
                            )}
                            {isSelected && (
                              <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                                <span className="text-white text-xs">▶</span>
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {site.name}
                            </div>
                            <div className="text-[11px] text-gray-400 truncate">
                              {site.location} • {shortPrice(site.price)}
                            </div>
                          </div>

                          {isSelected && (
                            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                              PLAYING
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ────────────────────────────────────────────────────────── */
        /* 📱 MOBILE TIKTOK / REELS VERTICAL FEED (Rendered ONLY on < 1024px) */
        /* ────────────────────────────────────────────────────────── */
        <div className="flex flex-col w-full h-full max-w-md mx-auto relative overflow-hidden bg-black">
          {/* Mobile Top App Bar */}
          <div className="absolute top-0 inset-x-0 z-30 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            {/* Prominent Back to Browse Button */}
            <button
              onClick={handleSafeClose}
              data-testid="reels-back-to-browse"
              aria-label="Back to browse listings"
              className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1 backdrop-blur-md border border-white/20 active:scale-95 transition-transform shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>

            {/* All vs Saved Segmented Switch */}
            <div className="flex items-center bg-black/50 backdrop-blur-md p-0.5 rounded-full border border-white/15">
              <button
                onClick={() => {
                  stopCurrentVideo();
                  setFeedTab("all");
                  setCurrentIndex(0);
                }}
                data-testid="reels-tab-all"
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  feedTab === "all" ? "bg-blue-600 text-white shadow" : "text-gray-300"
                }`}
              >
                All ({sitesWithVideos.length})
              </button>
              <button
                onClick={() => {
                  stopCurrentVideo();
                  setFeedTab("saved");
                  setCurrentIndex(0);
                }}
                data-testid="reels-tab-saved"
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                  feedTab === "saved" ? "bg-red-600 text-white shadow" : "text-gray-300"
                }`}
              >
                <span>❤️ Saved</span>
                <span>({savedSitesWithVideos.length})</span>
              </button>
            </div>

            {/* Close Icon Button */}
            <button
              onClick={handleSafeClose}
              data-testid="reels-close-mobile"
              aria-label="Close video tour"
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Empty State for Saved Tours on Mobile */}
          {activeSites.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white bg-black/90">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl mb-3">
                ❤️
              </div>
              <h3 className="text-lg font-bold mb-1.5">No Saved Video Tours</h3>
              <p className="text-gray-400 text-xs max-w-xs mb-5">
                Tap the ❤️ Save button on any property tour to quickly view your favorite properties here.
              </p>
              <button
                onClick={() => {
                  stopCurrentVideo();
                  setFeedTab("all");
                  setCurrentIndex(0);
                }}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg active:scale-95"
              >
                Browse All Tours ({sitesWithVideos.length})
              </button>
            </div>
          ) : (
            /* Mobile Reel Container with Real-Time Touch Dragging & Smooth Physics */
            <div
              className="relative w-full flex-1 my-auto bg-black overflow-hidden flex flex-col justify-end"
              style={{
                transform: `translateY(${dragOffsetY}px)`,
                transition: isDragging
                  ? "none"
                  : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform",
              }}
            >
              {/* Zero-Flicker Backdrop Poster: Renders immediately during swipe */}
              {youtubeId && (
                <div className="absolute inset-0 w-full h-full bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                    alt=""
                    className="w-full h-full object-cover opacity-60 filter blur-[1px] scale-105"
                  />
                </div>
              )}

              {embedUrl ? (
                <div className="absolute inset-0 w-full h-full">
                  <iframe
                    ref={mobileIframeRef}
                    key={`yt-player-mobile-${safeIndex}-${youtubeId}`}
                    src={embedUrl}
                    className="w-full h-full border-none relative z-10"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={currentSite?.name || "Property Video"}
                  />
                </div>
              ) : (
                <div className="relative z-10 absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                  No video available for this site.
                </div>
              )}

              {/* Floating swipe hint pill */}
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-black/60 backdrop-blur-md px-3.5 py-1 rounded-full text-white text-[11px] font-medium flex items-center gap-1.5 shadow border border-white/10">
                <span>↕</span>
                <span>
                  {safeIndex + 1}/{activeSites.length} • Swipe up/down for next tour
                </span>
              </div>

              {/* Paused indicator */}
              {isPaused && (
                <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/70 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-2xl animate-pulse">
                    <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Right-Side TikTok Action Column */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-3.5 z-30 pointer-events-auto">
                {/* Wishlist */}
                <button
                  onClick={() => toggleWishlist(displayId)}
                  data-testid="reels-like-button"
                  className="flex flex-col items-center active:scale-75 transition-transform"
                  aria-label="Wishlist property"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg ${
                      isLiked
                        ? "bg-red-500 text-white"
                        : "bg-black/50 text-white border border-white/20"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={isLiked ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth={isLiked ? "0" : "2"}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] text-white font-medium mt-0.5 drop-shadow">
                    {isLiked ? "Saved" : "Save"}
                  </span>
                </button>

                {/* Share Button (Robust Fallback & WhatsApp) */}
                <button
                  onClick={handleOpenShare}
                  data-testid="reels-share-button-mobile"
                  className="flex flex-col items-center active:scale-75 transition-transform"
                  aria-label="Share property"
                >
                  <div className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                      />
                    </svg>
                  </div>
                  <span className="text-[10px] text-white font-medium mt-0.5 drop-shadow">
                    Share
                  </span>
                </button>

                {/* Prev Video Arrow */}
                <button
                  onClick={goToPrev}
                  disabled={safeIndex === 0}
                  className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg transition-colors ${
                    safeIndex === 0
                      ? "bg-black/20 text-gray-500 cursor-not-allowed"
                      : "bg-black/50 text-white active:scale-90"
                  }`}
                  aria-label="Previous video"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
                  </svg>
                </button>

                {/* Next Video Arrow */}
                <button
                  onClick={goToNext}
                  disabled={safeIndex >= activeSites.length - 1}
                  className={`w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-lg transition-colors ${
                    safeIndex >= activeSites.length - 1
                      ? "bg-black/20 text-gray-500 cursor-not-allowed"
                      : "bg-black/50 text-white active:scale-90"
                  }`}
                  aria-label="Next video"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Gesture & Specs Bottom Area (Touch Drag Interceptor) */}
              <div
                data-testid="reels-gesture-overlay"
                className="relative z-30 p-4 pb-2 bg-gradient-to-t from-black via-black/90 to-transparent text-white pointer-events-auto touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Floating Specs at Bottom */}
                {currentSite && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        📍 {currentSite.location}
                      </span>
                      <span className="text-[10px] text-gray-300 bg-white/10 px-2 py-0.5 rounded font-mono">
                        ID: {displayId}
                      </span>
                      {currentSite.is_layout && currentSite.layout_name && (
                        <span className="text-[10px] text-amber-300 bg-amber-900/40 px-2 py-0.5 rounded font-medium">
                          🏡 {currentSite.layout_name}
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm font-bold text-white line-clamp-1 mb-1 drop-shadow">
                      {currentSite.name}
                    </h2>

                    <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                      <span className="text-lg font-black text-amber-400 drop-shadow">
                        {formatPrice(currentSite.price)}
                      </span>
                      <span className="text-[11px] text-gray-300 font-semibold bg-white/15 px-1.5 py-0.2 rounded">
                        {shortPrice(currentSite.price)}
                      </span>
                      {currentSite.area && (
                        <span className="text-xs text-gray-300">• {currentSite.area} Sq.ft</span>
                      )}
                      {currentSite.dimension && (
                        <span className="text-xs text-gray-300">• {currentSite.dimension}</span>
                      )}
                      {currentSite.facing && (
                        <span className="text-xs text-gray-300">• {currentSite.facing}</span>
                      )}
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleAddVisit}
                        disabled={inVisitList}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 ${
                          inVisitList
                            ? "bg-white/20 text-gray-300 cursor-default"
                            : "bg-[var(--color-primary)] text-white shadow-emerald-900/40"
                        }`}
                      >
                        <span>
                          {inVisitList ? "✓ Scheduled" : "📅 Schedule Visit"}
                        </span>
                      </button>

                      <Link
                        href={`/site/${displayId}`}
                        onClick={handleSafeClose}
                        className="py-2.5 px-4 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 text-center transition-colors active:scale-95"
                      >
                        Details &rarr;
                      </Link>
                    </div>
                  </div>
                )}

                {/* Swipe Up/Down Navigation Hint Bar */}
                <div className="mt-2 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400">
                  <button
                    onClick={handleSafeClose}
                    className="hover:text-white flex items-center gap-1 text-[10px] font-medium"
                  >
                    <span>← Return to browsing listings</span>
                  </button>
                  <span>↕ Drag up/down to glide</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 📤 SHARE SHEET MODAL (Unified Mobile/Desktop Fallback Sheet) */}
      {/* ────────────────────────────────────────────────────────── */}
      {isShareSheetOpen && (
        <div
          data-testid="share-sheet-modal"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsShareSheetOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-white/20 rounded-2xl p-5 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>↗️</span> Share Property Tour
              </h3>
              <button
                onClick={() => setIsShareSheetOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Share <strong className="text-white">{currentSite?.name}</strong> with friends or family on WhatsApp or copy the direct property tour link.
            </p>

            <div className="space-y-2 pt-1">
              {/* WhatsApp Button */}
              <button
                onClick={() => {
                  handleWhatsAppShare();
                  setIsShareSheetOpen(false);
                }}
                data-testid="share-whatsapp-button"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all shadow-lg"
              >
                <span>💬 Share on WhatsApp</span>
              </button>

              {/* Copy Link Button */}
              <button
                onClick={() => {
                  handleCopyLink();
                  setIsShareSheetOpen(false);
                }}
                data-testid="share-copy-button"
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm flex items-center justify-center gap-2 border border-white/15 active:scale-98 transition-all"
              >
                <span>📋 Copy Property Tour Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
