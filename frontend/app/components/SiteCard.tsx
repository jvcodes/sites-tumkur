import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

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
  };
}

export default function SiteCard({ site }: SiteCardProps) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { addToCart, isInCart } = useCart();
  
  const displayId = site.site_code || site.id_str || site._id || '';
  const isLiked = isInWishlist(displayId);
  const inVisitList = isInCart(displayId);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

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

  // Extract YouTube ID
  const getYoutubeVideoId = (url?: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };
  const youtubeId = getYoutubeVideoId((site as any).youtube_url);

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
    <div className="bg-white md:rounded-xl md:shadow-sm md:border md:border-gray-200 overflow-hidden mb-2 border-b border-gray-100 pb-4 md:pb-0 flex flex-col">
      
      {/* ── HEADER (Like Instagram User Info) ── */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 font-bold border border-blue-100 text-xs shrink-0">
            📍
          </div>
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-gray-900 leading-tight">
              {site.location}
            </h3>
            <p className="text-[11px] text-gray-500">
              ID: {displayId} • {site.status ? site.status.toUpperCase() : 'AVAILABLE'}
            </p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
        </button>
      </div>

      {/* ── MEDIA CAROUSEL (Edge-to-Edge on mobile) ── */}
      <div className="relative w-full aspect-[4/3] sm:aspect-video md:aspect-[4/3] bg-black group/carousel">
        <div ref={carouselRef} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth">
          {/* YouTube Video Slide */}
          {youtubeId && (
            <div className="w-full h-full flex-shrink-0 snap-center relative">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0`}
                srcDoc={`<style>*{padding:0;margin:0;overflow:hidden}html,body{height:100%}img{position:absolute;width:100%;height:100%;object-fit:cover}.play{position:absolute;top:0;bottom:0;left:0;right:0;margin:auto;width:64px;height:64px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;justify-content:center;align-items:center;color:white;border:1.5px solid rgba(255,255,255,0.4);transition:transform 0.2s}a:hover .play{transform:scale(1.1)}</style><a href=https://www.youtube.com/embed/${youtubeId}?autoplay=1><img src=https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg alt='Thumbnail'><div class='play'><svg style='width:32px;height:32px;margin-left:4px' fill='currentColor' viewBox='0 0 24 24'><path d='M8 5v14l11-7z' /></svg></div></a>`}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Property Video"
                loading="lazy"
              />
            </div>
          )}

          {/* Image Slides */}
          {media.map((imgUrl, idx) => (
            <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative">
              <Link href={`/site/${siteId}`} className="block w-full h-full">
                <img
                  src={imgUrl}
                  alt={`${site.name} - slide ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </Link>
            </div>
          ))}
        </div>

        {/* Carousel Indicators (Dots) */}
        {(youtubeId || media.length > 1) && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {youtubeId && <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow"></div>}
            {media.map((_, i) => (
              <div key={`dot-${i}`} className="w-1.5 h-1.5 rounded-full bg-white/50 shadow"></div>
            ))}
          </div>
        )}

        {/* Scroll Buttons */}
        {(youtubeId || media.length > 1) && (
          <>
            <button 
              onClick={scrollLeft}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-gray-800 shadow flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={scrollRight}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 text-gray-800 shadow flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </>
        )}

        {site.status?.toLowerCase() === 'sold' && (
          <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-2 py-1 rounded shadow-lg uppercase z-10">
            SOLD
          </div>
        )}
      </div>

      {/* ── ACTION BAR (Heart, Share, Visit) ── */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Wishlist */}
          <button
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
          
          {/* Share (Native Web Share) */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              const url = `${window.location.origin}/site/${siteId}`;
              if (navigator.share) {
                navigator.share({
                  title: site.name || 'SiteHub Listing',
                  text: `Check out this site in ${site.location} for ${shortPrice(site.price)}!`,
                  url: url,
                }).catch(err => console.error("Error sharing", err));
              } else if (navigator.clipboard) {
                navigator.clipboard.writeText(url);
                toast.success("Link copied to clipboard!");
              } else {
                // Insecure HTTP context fallback (e.g. mobile dev server)
                const textArea = document.createElement("textarea");
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                  document.execCommand('copy');
                  toast.success("Link copied to clipboard!");
                } catch (err) {
                  console.error('Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
              }
            }}
            className="text-gray-800 transition-transform active:scale-75"
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

      {/* ── DETAILS (Price, Specs, Desc) ── */}
      <div className="px-4 pb-3 flex flex-col">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-[15px] font-extrabold text-gray-900">{formatPrice(site.price)}</span>
          <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {shortPrice(site.price)}
          </span>
        </div>
        
        <p className="text-sm font-semibold text-gray-800 line-clamp-1 mb-1">
          {site.name}
        </p>

        <p className="text-xs text-gray-500 mb-2 flex flex-wrap gap-1 items-center">
          {site.area && <span>{site.area} Sq.ft</span>}
          {site.area && site.dimension && <span>•</span>}
          {site.dimension && <span>{site.dimension}</span>}
          {(site.area || site.dimension) && site.facing && <span>•</span>}
          {site.facing && <span>{site.facing} Facing</span>}
        </p>

        {site.is_layout && site.layout_name && (
          <p className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 self-start px-2 py-0.5 rounded mb-2">
            🏡 {site.layout_name}
          </p>
        )}
        
        <Link 
          href={`/site/${siteId}`} 
          onClick={() => sessionStorage.setItem('homeScrollPos', window.scrollY.toString())}
          className="text-xs text-gray-400 uppercase font-bold tracking-wider hover:text-gray-600 mt-1"
        >
          View full details &rarr;
        </Link>
      </div>
    </div>
  );
}
