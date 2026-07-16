"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

/** Smoothly counts to `value`, formatting each frame with `format`. */
export function AnimatedNumber({
  value,
  format = (n) => n.toFixed(1),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.6, ease: "easeOut" });
    return controls.stop;
  }, [mv, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
