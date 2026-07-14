"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteCard from "./components/SiteCard";
import ClientOnly from "./components/ClientOnly";

// Types for Filters
type FilterOption = { label: string; value: string; min?: number; max?: number };

const PRICE_RANGES: FilterOption[] = [
  { label: "Under 20 Lakhs", value: "0-2000000", min: 0, max: 2000000 },
  { label: "20 Lakhs - 50 Lakhs", value: "2000000-5000000", min: 2000000, max: 5000000 },
  { label: "50 Lakhs - 1 Crore", value: "5000000-10000000", min: 5000000, max: 10000000 },
  { label: "Above 1 Crore", value: "10000000-999999999", min: 10000000, max: 999999999 },
];

const AREA_RANGES: FilterOption[] = [
  { label: "Under 1000 sqft", value: "0-1000", min: 0, max: 1000 },
  { label: "1000 - 2000 sqft", value: "1000-2000", min: 1000, max: 2000 },
  { label: "2000 - 4000 sqft", value: "2000-4000", min: 2000, max: 4000 },
  { label: "4000+ sqft", value: "4000-999999", min: 4000, max: 999999 },
];

const FACING_OPTIONS = ["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"];

export default function Home() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Search Bar
  const [inputValue, setInputValue] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  
  // Locations
  const [locations, setLocations] = useState<string[]>([]);
  const [locationSearch, setLocationSearch] = useState("");
  
  // Checkbox Filters (Store arrays of selected values)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedFacings, setSelectedFacings] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<string>("");

  // Mobile Modals
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isMobileSortOpen, setIsMobileSortOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState("Location");

  const LIMIT = 12; // increased for desktop grid
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  // ── SessionStorage Restoration ──
  const isRestored = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Check if we should restore (if coming back from a detail page)
    const storedScroll = sessionStorage.getItem("homeScrollPos");
    if (storedScroll) {
      try {
        const savedState = sessionStorage.getItem("homeState");
        if (savedState) {
          const parsed = JSON.parse(savedState);
          setSites(parsed.sites || []);
          setTotal(parsed.total || 0);
          setPage(parsed.page || 1);
          setHasMore(parsed.hasMore || false);
          
          setSelectedLocations(parsed.selectedLocations || []);
          setSelectedPrices(parsed.selectedPrices || []);
          setSelectedAreas(parsed.selectedAreas || []);
          setSelectedFacings(parsed.selectedFacings || []);
          setSortOption(parsed.sortOption || "");
          setAppliedSearch(parsed.appliedSearch || "");
          setInputValue(parsed.inputValue || "");
          
          isRestored.current = true;
          
          // Wait for DOM to render the sites, then scroll
          setTimeout(() => {
            window.scrollTo(0, parseInt(storedScroll, 10));
            sessionStorage.removeItem("homeScrollPos"); // clear after restore
          }, 100);
          
          setLoading(false);
          return; // Skip initial fetch
        }
      } catch (e) {
        console.error("Failed to restore state", e);
      }
    }
    
    // If not restoring, set search from URL if present
    if (initialQuery) {
      setInputValue(initialQuery);
      setAppliedSearch(initialQuery);
    }
  }, [initialQuery]);

  // ── Save State ──
  useEffect(() => {
    if (!loading && !isRestored.current && sites.length > 0) {
      const stateToSave = {
        sites, total, page, hasMore,
        selectedLocations, selectedPrices, selectedAreas, selectedFacings,
        sortOption, appliedSearch, inputValue
      };
      sessionStorage.setItem("homeState", JSON.stringify(stateToSave));
    }
  }, [sites, total, page, hasMore, selectedLocations, selectedPrices, selectedAreas, selectedFacings, sortOption, appliedSearch, inputValue, loading]);

  // Fetch distinct locations
  useEffect(() => {
    fetch("/api/sites/locations")
      .then((r) => r.json())
      .then((data) => {
        if (data.locations?.length) setLocations(data.locations);
      })
      .catch(() => {});
  }, []);

  const filteredLocations = locations.filter(loc => loc.toLowerCase().includes(locationSearch.toLowerCase()));

  // Compute absolute min/max from selected checkboxes for API
  const computedFilters = useMemo(() => {
    let minPrice = "", maxPrice = "", minArea = "", maxArea = "";
    
    if (selectedPrices.length > 0) {
      const mins = selectedPrices.map(v => parseInt(v.split("-")[0]));
      const maxs = selectedPrices.map(v => parseInt(v.split("-")[1]));
      minPrice = Math.min(...mins).toString();
      maxPrice = Math.max(...maxs).toString();
    }

    if (selectedAreas.length > 0) {
      const mins = selectedAreas.map(v => parseInt(v.split("-")[0]));
      const maxs = selectedAreas.map(v => parseInt(v.split("-")[1]));
      minArea = Math.min(...mins).toString();
      maxArea = Math.max(...maxs).toString();
    }

    return {
      location: selectedLocations.join(","), // Though API currently takes 1 location regex, we pass it.
      minPrice, maxPrice, minArea, maxArea,
      facing: selectedFacings.join(","),
      sort: sortOption
    };
  }, [selectedLocations, selectedPrices, selectedAreas, selectedFacings, sortOption]);

  const doFetch = useCallback(
    async (
      search: string,
      filters: any,
      pageNum: number,
      append = false
    ) => {
      append ? setLoadingMore(true) : setLoading(true);
      try {
        let url = `/api/sites/filter?page=${pageNum}&limit=${LIMIT}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (filters.location) url += `&location=${encodeURIComponent(filters.location)}`; // Uses the first location mostly due to backend regex
        if (filters.minPrice) url += `&min_price=${filters.minPrice}`;
        if (filters.maxPrice) url += `&max_price=${filters.maxPrice}`;
        if (filters.minArea) url += `&min_area=${filters.minArea}`;
        if (filters.maxArea) url += `&max_area=${filters.maxArea}`;
        if (filters.facing) url += `&facing=${encodeURIComponent(filters.facing)}`;
        if (filters.sort) url += `&sort=${encodeURIComponent(filters.sort)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
        const tot: number = data.total ?? results.length;

        setSites((prev) => (append ? [...prev, ...results] : results));
        setTotal(tot);
        setHasMore(pageNum * LIMIT < tot);
      } catch (err) {
        console.error("Failed to fetch sites", err);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    []
  );

  // Trigger fetch when any filter changes
  useEffect(() => {
    // If we just restored from sessionStorage, do not re-fetch immediately 
    // unless a filter was actually clicked *after* restore.
    if (isRestored.current) {
      isRestored.current = false;
      return;
    }
    setPage(1);
    const t = setTimeout(() => doFetch(appliedSearch, computedFilters, 1, false), 300);
    return () => clearTimeout(t);
  }, [appliedSearch, computedFilters, doFetch]);

  const handleSearchClick = () => setAppliedSearch(inputValue);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    doFetch(appliedSearch, computedFilters, next, true);
  };

  const clearAllFilters = () => {
    setSelectedLocations([]);
    setSelectedPrices([]);
    setSelectedAreas([]);
    setSelectedFacings([]);
    setSortOption("");
    setAppliedSearch("");
    setInputValue("");
    setLocationSearch("");
    setIsMobileFilterOpen(false);
  };

  // Helper for toggling array state
  const toggleSelection = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const activeFilterCount = selectedLocations.length + selectedPrices.length + selectedAreas.length + selectedFacings.length + (sortOption ? 1 : 0);

  // Reusable Sidebar Content
  const SidebarContent = () => (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-gray-900">Filters</h3>
        {activeFilterCount > 0 && (
          <button onClick={clearAllFilters} className="text-[var(--color-accent)] text-sm font-semibold hover:underline">
            CLEAR ALL
          </button>
        )}
      </div>

      {/* Locations */}
      <div className="space-y-3">
        <h4 className="font-semibold text-gray-800 uppercase text-xs tracking-wider">Location</h4>
        <input 
          suppressHydrationWarning
          type="text" 
          placeholder="Search location..." 
          value={locationSearch}
          onChange={(e) => setLocationSearch(e.target.value)}
          className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        />
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {filteredLocations.map(loc => (
            <label key={loc} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleSelection(setSelectedLocations, loc)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-all cursor-pointer" />
              <span className="text-gray-700 group-hover:text-gray-900">{loc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="space-y-3 border-t border-gray-100 pt-5">
        <h4 className="font-semibold text-gray-800 uppercase text-xs tracking-wider">Price Range</h4>
        <div className="space-y-2">
          {PRICE_RANGES.map(range => (
            <label key={range.value} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={selectedPrices.includes(range.value)} onChange={() => toggleSelection(setSelectedPrices, range.value)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-all cursor-pointer" />
              <span className="text-gray-700 group-hover:text-gray-900">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Area */}
      <div className="space-y-3 border-t border-gray-100 pt-5">
        <h4 className="font-semibold text-gray-800 uppercase text-xs tracking-wider">Area (Sq.ft)</h4>
        <div className="space-y-2">
          {AREA_RANGES.map(range => (
            <label key={range.value} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={selectedAreas.includes(range.value)} onChange={() => toggleSelection(setSelectedAreas, range.value)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)] transition-all cursor-pointer" />
              <span className="text-gray-700 group-hover:text-gray-900">{range.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Facing */}
      <div className="space-y-3 border-t border-gray-100 pt-5">
        <h4 className="font-semibold text-gray-800 uppercase text-xs tracking-wider">Facing</h4>
        <div className="grid grid-cols-2 gap-2">
          {FACING_OPTIONS.map(face => (
            <label key={face} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={selectedFacings.includes(face)} onChange={() => toggleSelection(setSelectedFacings, face)} className="w-4 h-4 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)] cursor-pointer" />
              <span className="text-sm text-gray-700">{face}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      
      {/* ── HEADER / NAV ─────────────────────────────────── */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6 flex-1">
            <Link href="/" className="font-bold text-xl text-[var(--color-primary)]">TumkurSites</Link>
            
            {/* Desktop Search Bar */}
            <div className="hidden md:flex flex-1 max-w-xl relative">
              <input 
                suppressHydrationWarning
                type="text" 
                placeholder="Search for plots, sites, landmarks..." 
                className="w-full bg-gray-100 border-none rounded-xl py-2.5 pl-10 pr-4 focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm transition-all"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setAppliedSearch(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
          </div>
          
          <a href="/upload-site" className="hidden md:flex bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold py-2 px-5 rounded-lg transition-colors text-sm">
            + Post Property Free
          </a>
        </div>
        
        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 py-3 border-t border-gray-100 bg-white">
          <div className="relative">
            <input 
              suppressHydrationWarning
              type="text" 
              placeholder="Search area, landmark..." 
              className="w-full bg-gray-100 border-none rounded-xl py-2.5 pl-10 pr-4 focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setAppliedSearch(e.target.value);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          
          {/* Mobile Sort & Filter Buttons */}
          <div className="flex items-center gap-3 mt-3">
            <button 
              onClick={() => setIsMobileSortOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 font-semibold text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg active:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
              Sort
            </button>
            <button 
              onClick={() => setIsMobileFilterOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 font-semibold text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg active:bg-gray-100 transition-colors relative"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
              Filter
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[var(--color-accent)] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white shadow-sm">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── E-COMMERCE LAYOUT (SIDEBAR + GRID) ────────────── */}
      <div className="max-w-screen-2xl mx-auto px-0 md:px-4 py-4 md:py-6 flex gap-6 items-start">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-72 shrink-0 sticky top-24 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
          <SidebarContent />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 px-4 md:px-0">
          
          {/* Header & Sort */}
          <div className="hidden md:flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Plots for Sale in Tumkur</h2>
              {!loading && <p className="text-gray-500 text-sm mt-1">{total} properties found</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Sort by:</span>
              <select 
                suppressHydrationWarning
                value={sortOption} 
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] block p-2 outline-none cursor-pointer"
              >
                <option value="">Relevance</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
          </div>

          <div className="md:hidden mb-4">
             <h2 className="text-lg font-bold text-gray-900">Plots in Tumkur</h2>
             {!loading && <p className="text-gray-500 text-xs">{total} properties found</p>}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-80 bg-white border border-gray-100 rounded-2xl animate-pulse shadow-sm" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && sites.length === 0 && (
            <div className="text-center py-24 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
              <img src="/pattern.png" className="w-32 h-32 opacity-20 grayscale mb-4" alt="" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">No properties found</h3>
              <p className="text-gray-500 mb-6 max-w-md">Try adjusting your filters or searching for a different area to see more results.</p>
              <button onClick={clearAllFilters} className="bg-[var(--color-primary)] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-opacity-90 transition">
                Clear Filters
              </button>
            </div>
          )}

          {/* Properties Grid */}
          {!loading && sites.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {sites.map((site) => (
                <SiteCard key={site.id || site.site_code} site={site} />
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && !loading && (
            <div className="flex justify-center mt-10 mb-8">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold py-3 px-12 rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load More Properties"}
              </button>
            </div>
          )}
        </div>
      </div>



      {/* ── MOBILE SORT MODAL (BOTTOM SHEET) ──────── */}
      {isMobileSortOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsMobileSortOpen(false)} />
          <div className="relative bg-white w-full rounded-t-2xl animate-slide-up pb-safe">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">Sort By</h3>
              <button onClick={() => setIsMobileSortOpen(false)} className="p-2 text-gray-500">✕</button>
            </div>
            <div className="p-2">
              {[
                { label: "Relevance", value: "" },
                { label: "Price: Low to High", value: "price_low" },
                { label: "Price: High to Low", value: "price_high" }
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { setSortOption(opt.value); setIsMobileSortOpen(false); }}
                  className={`w-full text-left px-4 py-4 rounded-xl font-medium transition-colors ${sortOption === opt.value ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'text-gray-700 active:bg-gray-50'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE FILTER MODAL (BOTTOM SHEET) ──────── */}
      {isMobileFilterOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => setIsMobileFilterOpen(false)} />
          
          {/* Bottom Sheet Panel */}
          <div className="relative bg-gray-50 w-full rounded-t-3xl animate-slide-up pb-safe flex flex-col max-h-[85vh]">
            {/* Handle / Drag Indicator */}
            <div className="flex justify-center pt-3 pb-1 bg-white rounded-t-3xl">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white">
              <h3 className="font-bold text-lg text-gray-900">Filters</h3>
              <button onClick={clearAllFilters} className="text-sm font-semibold text-[var(--color-accent)]">Clear All</button>
            </div>
            
            {/* 2-Column Content */}
            <div className="flex-1 flex overflow-hidden min-h-[50vh]">
              {/* Left Tabs */}
              <div className="w-1/3 bg-gray-100 border-r border-gray-200 overflow-y-auto">
                {["Location", "Price", "Area", "Facing"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveMobileTab(tab)}
                    className={`w-full text-left px-4 py-4 text-sm font-semibold border-b border-gray-200 transition-colors ${activeMobileTab === tab ? 'bg-white text-[var(--color-accent)] border-l-4 border-l-[var(--color-accent)]' : 'text-gray-600 active:bg-gray-200'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {/* Right Content */}
              <div className="w-2/3 bg-white overflow-y-auto p-4 space-y-4">
              {activeMobileTab === "Location" && (
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Search location..." 
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[var(--color-accent)] mb-2"
                  />
                  {filteredLocations.map(loc => (
                    <label key={loc} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleSelection(setSelectedLocations, loc)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                      <span className="text-sm text-gray-700">{loc}</span>
                    </label>
                  ))}
                </div>
              )}
              {activeMobileTab === "Price" && (
                <div className="space-y-4">
                  {PRICE_RANGES.map(range => (
                    <label key={range.value} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selectedPrices.includes(range.value)} onChange={() => toggleSelection(setSelectedPrices, range.value)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                      <span className="text-sm text-gray-700">{range.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {activeMobileTab === "Area" && (
                <div className="space-y-4">
                  {AREA_RANGES.map(range => (
                    <label key={range.value} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selectedAreas.includes(range.value)} onChange={() => toggleSelection(setSelectedAreas, range.value)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                      <span className="text-sm text-gray-700">{range.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {activeMobileTab === "Facing" && (
                <div className="space-y-4">
                  {FACING_OPTIONS.map(face => (
                    <label key={face} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={selectedFacings.includes(face)} onChange={() => toggleSelection(setSelectedFacings, face)} className="w-5 h-5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
                      <span className="text-sm text-gray-700">{face}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Action */}
          <div className="p-4 border-t border-gray-200 bg-white pb-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
            <button 
              onClick={() => setIsMobileFilterOpen(false)}
              className="w-full bg-[var(--color-accent)] text-white font-bold py-3.5 rounded-xl text-lg shadow-lg active:scale-[0.98] transition-transform"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes scale-in { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.25s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </main>
  );
}
