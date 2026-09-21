"use client";

import React from "react";

/**
 * Props for the Pagination component.
 */
interface PaginationProps {
  /** The 1-based index of the currently active page */
  currentPage: number;
  /** Total number of pages available */
  totalPages: number;
  /** Callback triggered when the user navigates to a new page */
  onPageChange: (page: number) => void;
}

/**
 * Responsive Pagination Component
 *
 * Designed to prevent horizontal text/button overflow across all viewport widths:
 * - Mobile (< 640px): Compact Prev/Next buttons with a centered "Page X of Y" label.
 * - Desktop (>= 640px): Windowed page button strip (up to 7 items with ellipsis if needed)
 *   so large page counts never break container boundaries.
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  // If there is only 1 page (or none), no pagination controls are needed.
  if (totalPages <= 1) return null;

  /**
   * Generates windowed page numbers for desktop layout.
   * If totalPages <= 7, renders all numbers.
   * If totalPages > 7, renders smart slices with ellipsis ("...").
   */
  const getDesktopPages = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Near start
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    // Near end
    if (currentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    // In middle
    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  const desktopPages = getDesktopPages();

  return (
    <nav
      aria-label="Pagination Navigation"
      className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6 max-w-full"
    >
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        ← Previous
      </button>

      {/* Mobile View: Compact "Page X of Y" (prevents button overflow on narrow screens) */}
      <span className="sm:hidden text-xs font-semibold text-gray-600 px-2 truncate">
        Page {currentPage} of {totalPages}
      </span>

      {/* Desktop View: Windowed Page Numbers */}
      <div className="hidden sm:flex items-center gap-1 overflow-hidden">
        {desktopPages.map((item, idx) => {
          if (item === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-9 h-9 flex items-center justify-center text-xs text-gray-400 font-bold select-none"
              >
                …
              </span>
            );
          }

          const pageNum = Number(item);
          const isActive = currentPage === pageNum;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              aria-current={isActive ? "page" : undefined}
              aria-label={`Go to page ${pageNum}`}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
              }`}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-200 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        Next →
      </button>
    </nav>
  );
}
