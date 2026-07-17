"use client";

import { useEffect, useState } from "react";

/**
 * RobinMarkets logo mark — a feather shaft whose barbs rise into candlesticks and
 * an up-arrow, echoing the brand logo. Shapes use `currentColor` so it inverts
 * cleanly: black on the lime badge, lime on dark backgrounds.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      {/* feather shaft */}
      <path
        d="M15 40 C 18 30, 22 20, 34 9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* feather barbs on the left of the shaft */}
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.9">
        <path d="M18 31 L 12 33" />
        <path d="M20.5 26 L 14.5 27.5" />
        <path d="M23.5 21 L 18 22" />
        <path d="M27 16 L 22 16.5" />
      </g>
      {/* ascending candlesticks along the shaft (the "market" barbs) */}
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <line x1="20" y1="34" x2="20" y2="27" />
        <line x1="25" y1="30" x2="25" y2="22" />
        <line x1="30" y1="24" x2="30" y2="15" />
      </g>
      <g fill="currentColor">
        <rect x="18.4" y="29" width="3.2" height="4.5" rx="0.8" />
        <rect x="23.4" y="24.5" width="3.2" height="5" rx="0.8" />
        <rect x="28.4" y="18" width="3.2" height="5.5" rx="0.8" />
      </g>
      {/* up-arrow tip */}
      <path d="M31 12 L 36 8 L 35 14 Z" fill="currentColor" />
      <path d="M34 9 L 39 5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Brand badge. Prefers /logo.png (drop your artwork in web/public/); if that
 * file is absent, falls back to the built-in lime SVG mark so nothing breaks.
 */
export function LogoBadge({ className = "" }: { className?: string }) {
  // Default to the SVG mark; probe for /logo.png on mount and swap in if it loads.
  // This avoids the SSR broken-image flash when no logo.png has been added yet.
  const [imgOk, setImgOk] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgOk(true);
    img.onerror = () => setImgOk(false);
    img.src = "/logo.png";
  }, []);

  if (imgOk) {
    return (
      <span className={`relative overflow-hidden rounded-lg ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="RobinMarkets" className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span className={`grid place-items-center rounded-lg bg-lime text-black ${className}`}>
      <LogoMark className="h-[78%] w-[78%]" />
    </span>
  );
}
