"use client";

import { useEffect, useRef } from "react";

/**
 * Full-page animated candlestick chart drawn on a canvas, sitting behind all
 * content at low opacity. Candles scroll right→left on a random walk. Respects
 * prefers-reduced-motion (renders a single static frame).
 */
export function MarketBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const CW = 16; // candle slot width
    let candles: { o: number; c: number; h: number; l: number; up: boolean }[] = [];
    let W = 0,
      H = 0,
      last = 50;

    function nextCandle() {
      const o = last;
      const drift = (Math.random() - 0.5) * 8;
      const c = Math.max(8, Math.min(92, o + drift));
      const h = Math.max(o, c) + Math.random() * 4;
      const l = Math.min(o, c) - Math.random() * 4;
      last = c;
      return { o, c, h, l, up: c >= o };
    }

    function resize() {
      W = canvas!.clientWidth;
      H = canvas!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const need = Math.ceil(W / CW) + 2;
      while (candles.length < need) candles.push(nextCandle());
    }

    // Map price 0..100 to a y band in the middle-lower area.
    const y = (p: number) => H * 0.25 + (1 - p / 100) * H * 0.55;

    function draw(offset: number) {
      ctx!.clearRect(0, 0, W, H);
      // faint horizontal grid
      ctx!.strokeStyle = "rgba(255,255,255,0.04)";
      ctx!.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const gy = (H / 4) * g;
        ctx!.beginPath();
        ctx!.moveTo(0, gy);
        ctx!.lineTo(W, gy);
        ctx!.stroke();
      }
      candles.forEach((cd, i) => {
        const x = i * CW - offset;
        const up = cd.up;
        const color = up ? "0,209,121" : "255,90,95";
        ctx!.strokeStyle = `rgba(${color},0.32)`;
        ctx!.fillStyle = `rgba(${color},0.22)`;
        ctx!.lineWidth = 1.2;
        // wick
        ctx!.beginPath();
        ctx!.moveTo(x + CW / 2, y(cd.h));
        ctx!.lineTo(x + CW / 2, y(cd.l));
        ctx!.stroke();
        // body
        const top = y(Math.max(cd.o, cd.c));
        const bot = y(Math.min(cd.o, cd.c));
        ctx!.fillRect(x + 3, top, CW - 6, Math.max(1.5, bot - top));
      });
    }

    resize();
    window.addEventListener("resize", resize);

    if (reduce) {
      draw(0);
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    let offset = 0;
    function frame() {
      offset += 0.35;
      if (offset >= CW) {
        offset -= CW;
        candles.shift();
        candles.push(nextCandle());
      }
      draw(offset);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: -1 }}
    />
  );
}
