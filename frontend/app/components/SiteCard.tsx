import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useState, useRef, memo } from 'react';
import toast from 'react-hot-toast';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import ShareModal from './ShareModal';

interface SiteCardProps {
  site: {
    id_str?: string;
    _id?: string;
    name: string;
    location: string;
    price: number;
    area: number;
    image?: string;
    images?: string[];
    youtube_url?: string;
    status: string;
    type?: string;
    site_code?: string;
    facing?: string;
    dimension?: string;
    latitude?: number;
    longitude?: number;
    is_layout?: boolean;
    layout_name?: string;
    tuda_approved?: boolean;
    bbmp_approved?: boolean;
    corner_site?: boolean;
    is_test?: boolean;
  };
}

const SiteCard = memo(function SiteCard({ site }: SiteCardProps) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart, isInCart } = useCart();
  
  const displayId = site.site_code || site.id_str || site._id || '';
  const isLiked = isInWishlist(displayId);
  const inVisitList = isInCart(displayId);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { ref: cardRef, isVisible } = useScrollReveal({ threshold: 0.1 });

  // Graceful fallback for ID and Image
  const siteId = displayId || '#';

  const addToVisitList = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inVisitList) return;

    addToCart({
      site_code: displayId,
      name: site.name,
      location: site.location,
      price: site.price,
      image: site.images?.[0] || site.image || '/no-image.svg',
      images: site.images,
      latitude: site.latitude,
      longitude: site.longitude,
      area: site.area,
      dimension: site.dimension,
      facing: site.facing,
    });
  };

  const scrollLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, offsetWidth } = carouselRef.current;
      if (scrollLeft <= 10) {
        carouselRef.current.scrollTo({ left: scrollWidth, behavior: 'smooth' });
      } else {
        carouselRef.current.scrollBy({ left: -offsetWidth, behavior: 'smooth' });
      }
    }
  };

  const scrollRight = (e: React.MouseEvent) => {
    e.preventDefault();
    if (carouselRef.current) {
      const { scrollLeft, scrollWidth, offsetWidth } = carouselRef.current;
      if (scrollLeft + offsetWidth >= scrollWidth - 10) {
        carouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        carouselRef.current.scrollBy({ left: offsetWidth, behavior: 'smooth' });
      }
    }
  };

  // Build media array
  const media: string[] = [];
  if (site.images && site.images.length > 0) {
    media.push(...site.images);
  } else if (site.image && site.image !== '') {
    media.push(site.image);
  } else {
    media.push('/no-image.svg');
  }

  // Formatter for Indian Rupees — full price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Short label: e.g. "25 Lakh" or "1.5 Cr" — familiar to Indian buyers
  const shortPrice = (price: number): string => {
    if (price >= 10000000) return `${(price / 10000000).toFixed(1)} Cr`;
    if (price >= 100000)   return `${(price / 100000).toFixed(1)} Lakh`;
    return price.toLocaleString('en-IN');
  };

  return (
    <div 
      ref={cardRef}
      className={`bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 overflow-hidden mb-2 border-b border-gray-100 pb-4 md:pb-0 flex flex-col transition-all duration-700 ease-out transform ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      
      {/* ── HEADER (Like Instagram User Info) ── */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 font-bold border border-blue-100 text-xs shrink-0">
            📍
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-gray-900 leading-tight capitalize">
              {site.location || "Tumkur"}
            </h2>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              {site.status?.toLowerCase() === "sold" ? (
                <span className="font-semibold text-red-600">Sold Out</span>
              ) : (
                <span className="font-medium text-emerald-700 flex items-center gap-0.5">
                  <span className="text-[10px]">✓</span> Verified Plot
                </span>
              )}
              <span>•</span>
              <span>ID: {displayId}</span>
            </p>
          </div>
        </div>
        <button aria-label="More options" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
        </button>
      </div>

      {/* ── MEDIA CAROUSEL (Edge-to-Edge on mobile) ── */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video md:aspect-[4/3] bg-black group/carousel">
        <div ref={carouselRef} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth">
          {/* Image Slides */}
          {media.map((imgUrl, idx) => (
            <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative">
              <Link href={`/site/${siteId}`} className="block w-full h-full" onClick={() => sessionStorage.setItem('homeScrollPos', window.scrollY.toString())}>
                <img
                  src={imgUrl}
                  alt={`${site.name} - slide ${idx + 1}`}
                  className="w-full h-full object-cover transition-opacity duration-500 ease-in-out opacity-0"
                  loading="lazy"
                  decoding="async"
                  onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                />
              </Link>
            </div>
          ))}
        </div>

        {/* Carousel Indicators (Dots) */}
        {media.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {media.map((_, i) => (
              <div key={`dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-white/70 shadow"></div>
            ))}
          </div>
        )}

        {/* Scroll Buttons */}
        {media.length > 1 && (
          <>
            <button 
              aria-label="Previous image"
              onClick={scrollLeft}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-gray-800 shadow flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              aria-label="Next image"
              onClick={scrollRight}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-gray-800 shadow flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}

        {/* ── CONSISTENT PLOT DIMENSION PILL (Always visible on photo) ── */}
        {site.dimension ? (
          <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md shadow flex items-center gap-1 z-10 pointer-events-none tracking-wide">
            <span>📏</span>
            <span>{site.dimension.replace(/\s*x\s*/i, ' × ')}</span>
          </div>
        ) : site.area ? (
          <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md shadow flex items-center gap-1 z-10 pointer-events-none">
            <span>📏</span>
            <span>{site.area} sq.ft</span>
          </div>
        ) : null}

        {site.status?.toLowerCase() === 'sold' && (
          <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-2 py-1 rounded shadow-lg uppercase z-10">
            SOLD
          </div>
        )}

        <div className="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md pointer-events-none flex items-center gap-1 opacity-90">
          <span>View details</span>
          <span>→</span>
        </div>
      </div>

      {/* ── ACTION BAR (Heart, Share, Tour, Visit) ── */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Wishlist */}
          <button
            aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
            onClick={(e) => {
              e.preventDefault();
              toggleWishlist(displayId);
            }}
            className={`transition-transform active:scale-75 ${isLiked ? 'text-red-500' : 'text-gray-800'}`}
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isLiked ? "0" : "1.5"}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>
          
          {/* Share (WhatsApp + Copy Link Modal) */}
          <button 
            aria-label="Share property"
            data-testid="share-property-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsShareModalOpen(true);
            }}
            className="text-gray-800 hover:text-emerald-600 transition-all active:scale-75"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
        
        {/* Visit List Button */}
        <button
          onClick={addToVisitList}
          disabled={inVisitList}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${inVisitList ? 'bg-gray-100 text-gray-400' : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-light)]'}`}
        >
          {inVisitList ? 'Added to Visits' : 'Schedule Visit'}
        </button>
      </div>

      {/* ── DETAILS (Price, Rate/Sq.ft, Specs, Desc) ── */}
      <div className="px-4 pb-4 flex flex-col">
        <Link 
          href={`/site/${siteId}`}
          onClick={() => sessionStorage.setItem('homeScrollPos', window.scrollY.toString())}
          className="group/title block"
        >
          {/* Unified Pricing Row: Total Budget + Rate per Sq.Ft */}
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[17px] font-extrabold text-gray-900 group-hover/title:text-red-600 transition-colors tracking-tight">
                {formatPrice(site.price)}
              </span>
              {site.price >= 100000 && (
                <span className="text-[11px] font-bold text-gray-500">
                  ({shortPrice(site.price)})
                </span>
              )}
            </div>
            {site.area && site.area > 0 && site.price > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md shrink-0">
                ₹{Math.round(site.price / site.area).toLocaleString("en-IN")}/sq.ft
              </span>
            )}
          </div>
          
          <p className="text-sm font-semibold text-gray-800 line-clamp-1 mb-1 group-hover/title:text-red-600 transition-colors">
            {!site.name || site.name.toLowerCase() === "no name" || site.name.toLowerCase() === "yes"
              ? `${site.dimension ? site.dimension.replace(/\s*x\s*/i, " × ") + " " : ""}Plot in ${site.location || "Tumkur"}`
              : site.name}
          </p>
        </Link>

        {/* High-Signal Specs Row with Location, Area, Facing & Corner Badge */}
        <p className="text-xs text-gray-500 mb-2 flex flex-wrap gap-1.5 items-center">
          {site.location && <span className="font-semibold text-gray-700">{site.location}</span>}
          {site.location && (site.area || site.facing || site.corner_site) && <span>•</span>}
          {site.area && <span>{site.area} Sq.ft</span>}
          {site.area && (site.facing || site.corner_site) && <span>•</span>}
          {site.facing && <span>{site.facing} Facing</span>}
          {site.facing && site.corner_site && <span>•</span>}
          {site.corner_site && (
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded text-[11px]">
              <span>📐</span> Corner Plot
            </span>
          )}
        </p>

        {site.is_layout && site.layout_name && (
          <p className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 self-start px-2 py-0.5 rounded mb-1">
            🏡 {site.layout_name}
          </p>
        )}
        
        {/* Prominent Primary Call-to-Action (High-Contrast, Full-Width Button) */}
        <Link 
          href={`/site/${siteId}`} 
          onClick={() => sessionStorage.setItem('homeScrollPos', window.scrollY.toString())}
          data-testid="view-full-details-btn"
          className="mt-2.5 w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs tracking-wide shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 group/btn active:scale-[0.99]"
        >
          <span>View full details</span>
          <span className="font-bold text-sm group-hover/btn:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      {/* Cross-Platform WhatsApp & Copy Link Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        site={{
          site_code: displayId,
          name: site.name,
          location: site.location,
          price: site.price,
          area: site.area,
          dimension: site.dimension,
          image: media[0] || '/no-image.svg',
          images: site.images,
          tuda_approved: site.tuda_approved,
        }}
      />
    </div>
  );
});

export default SiteCard;
