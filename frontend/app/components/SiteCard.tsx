import Image from 'next/image';
import Link from 'next/link';
import { useWishlist } from '../context/WishlistContext';
import { useState, useEffect } from 'react';

interface SiteCardProps {
  site: {
    id_str?: string;
    _id?: string;
    name: string;
    location: string;
    price: number;
    area: number;
    image?: string;
    status: string;
    type?: string;
    site_code?: string;
  };
}

export default function SiteCard({ site }: SiteCardProps) {
  const { toggleWishlist, isInWishlist } = useWishlist();
  const displayId = site.site_code || site.id_str || site._id || '';
  const isLiked = isInWishlist(displayId);
  const [inVisitList, setInVisitList] = useState(false);

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    setInVisitList(raw.some((item: any) => (item.site_code || item.code) === displayId));
  }, [displayId]);

  const addToVisitList = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inVisitList) return;

    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    const siteToAdd = {
      site_code: displayId,
      name: site.name,
      location: site.location,
      price: site.price,
      image: site.image,
    };

    const normalized = [...raw, siteToAdd];
    const unique = Array.from(new Map(normalized.map((i: any) => [i.site_code, i])).values());
    localStorage.setItem("cart", JSON.stringify(unique));
    setInVisitList(true);
  };

  // Graceful fallback for ID and Image
  const siteId = site.id_str || site._id || '#';
  const imageUrl = site.image && site.image !== ''
    ? site.image
    : '/no-image.svg'; // Make sure this exists in public/

  // Formatter for Indian Rupees
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      {/* Image Container */}
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
        <Image
          src={imageUrl}
          alt={site.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {/* Status Badge */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          {site.status || 'For Sale'}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault(); // Prevent navigating to details
            toggleWishlist(displayId);
          }}
          className={`absolute top-3 right-3 p-2 rounded-full transition-all ${isLiked ? 'bg-red-50 text-red-600' : 'bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white'
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            {isLiked ? (
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" fillOpacity="0" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-wider mb-1">
              {site.location}
            </p>
            <h3 className="text-lg font-bold text-[var(--color-primary)] line-clamp-1">
              {site.name}
            </h3>
          </div>
        </div>

        <div className="flex items-baseline gap-1 my-3">
          <span className="text-xl font-bold text-gray-900">{formatPrice(site.price)}</span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4 border-t border-gray-50 pt-3">
          <div className="flex items-center gap-2">
            <span>📐 {site.area} sq.ft</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📍 {site.location}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={`/site/${siteId}`}
            className="flex-1 text-center py-2.5 rounded-lg border border-[var(--color-primary)] text-[var(--color-primary)] font-medium hover:bg-[var(--color-primary)] hover:text-white transition-colors text-sm"
          >
            View Details
          </Link>
          <button
            onClick={addToVisitList}
            disabled={inVisitList}
            className={`flex-1 text-center py-2.5 rounded-lg border transition-colors text-sm font-medium ${inVisitList
              ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white cursor-not-allowed opacity-80'
              : 'border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-white'
              }`}
          >
            {inVisitList ? 'In Visit List' : 'Add to Visit'}
          </button>
        </div>
      </div>
    </div>
  );
}
