"use client";

import { motion } from "framer-motion";

/** Tiny area sparkline. `data` are values in [0,1]; `up` picks the accent color. */
export function Sparkline({
  data,
  up = true,
  width = 120,
  height = 40,
  fluid = false,
}: {
  data: number[];
  up?: boolean;
  width?: number;
  height?: number;
  /** Stretch to the container width instead of a fixed pixel width. */
  fluid?: boolean;
}) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const y = (v: number) => height - ((v - min) / range) * (height - 4) - 2;
  const pts = data.map((v, i) => `${i * stepX},${y(v)}`);
  const line = `M ${pts.join(" L ")}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  const color = up ? "#00d179" : "#ff5a5f";
  const id = `spark-${up ? "u" : "d"}-${Math.round(data[0] * 1000)}`;

  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : "xMidYMid meet"}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: "easeInOut" }}
      />
    </svg>
  );
}
