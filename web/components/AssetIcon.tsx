"use client";

import { useState } from "react";
import { assetEmoji, assetLogo } from "@/lib/derived";

/**
 * Shows a company/brand logo for an underlying (Meta, SpaceX, Nvidia…), falling
 * back to the emoji when the asset has no brand logo (gold, oil, indices) or the
 * logo fails to load.
 */
export function AssetIcon({
  underlying,
  size = 24,
  className = "",
}: {
  underlying: string;
  size?: number;
  className?: string;
}) {
  const logo = assetLogo(underlying);
  const [failed, setFailed] = useState(false);

  if (!logo || failed) {
    return (
      <span className={className} style={{ fontSize: Math.round(size * 0.82), lineHeight: 1 }}>
        {assetEmoji(underlying)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={underlying}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`rounded object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
