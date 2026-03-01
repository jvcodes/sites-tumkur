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
    facing?: string;
    dimension?: string;
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
  const siteId = site.site_code || site.id_str || site._id || '#';
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
    <div className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col pt-1 relative p-1">
      {/* Status & ID Ribbon */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <span className={`px-3 py-1 bg-white/95 backdrop-blur-md rounded-md shadow text-xs font-black tracking-widest border ${site.status?.toLowerCase() === 'sold' ? 'text-red-700 border-red-200' :
          site.status?.toLowerCase() === 'reserved' ? 'text-orange-600 border-orange-200' :
            'text-green-700 border-green-200'
          }`}>
          {site.status ? site.status.toUpperCase() : 'AVAILABLE'}
        </span>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2 items-center">
        <span className="bg-blue-900/90 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm tracking-wide">
          {displayId}
        </span>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(displayId);
          }}
          className={`p-1.5 rounded-full shadow-sm transition-all bg-white/90 ${isLiked ? 'text-red-600' : 'text-gray-400 hover:text-red-500 hover:bg-white'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            {isLiked ? (
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" fillOpacity="0" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        </button>
      </div>

      {/* Image Container */}
      <div className="relative h-56 w-full rounded-t-lg overflow-hidden bg-gray-100">
        <Image
          src={imageUrl}
          alt={site.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            📍 {site.location}
          </p>
          <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover:text-red-600 transition-colors">
            {site.name || "Real Estate Plot"}
          </h3>
        </div>

        <div className="mb-4">
          <span className="text-2xl font-extrabold text-red-600">{formatPrice(site.price)}</span>
        </div>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm text-gray-700 mb-5 border-y border-gray-100 py-3 mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Plot Size</span>
            <span className="font-semibold">{site.area ? `${site.area} Sq.ft` : "N/A"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Dimension</span>
            <span className="font-semibold">{site.dimension || "N/A"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Facing</span>
            <span className="font-semibold">{site.facing || "N/A"}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Price/Sq.ft</span>
            <span className="font-semibold">{site.area && site.area > 0 ? `₹${Math.round(site.price / site.area).toLocaleString()}` : "N/A"}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href={`/site/${siteId}`}
            className="flex-1 text-center py-2.5 rounded-lg border-2 border-red-600 text-red-600 font-bold hover:bg-red-600 hover:text-white transition-colors text-sm"
          >
            View Details
          </Link>
          <button
            onClick={addToVisitList}
            disabled={inVisitList}
            className={`px-4 py-2.5 rounded-lg transition-colors text-sm font-bold flex items-center justify-center ${inVisitList
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
              }`}
            title="Add to Visit List"
          >
            {inVisitList ? '📋 Added' : '➕ Visit'}
          </button>
        </div>
      </div>
    </div>
  );
}
