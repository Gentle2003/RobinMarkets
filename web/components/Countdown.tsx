"use client";

import { useEffect, useState } from "react";

function parts(totalSecs: number) {
  return {
    d: Math.floor(totalSecs / 86400),
    h: Math.floor((totalSecs % 86400) / 3600),
    m: Math.floor((totalSecs % 3600) / 60),
    s: Math.floor(totalSecs % 60),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function Seg({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[3rem] flex-col items-center rounded-lg border border-border bg-surface-2 px-2 py-1.5">
      <span className="text-lg font-bold leading-none tabular text-lime">{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
}

/**
 * Live countdown to a market's resolution. Shows a resolved/resolving state once
 * the target time passes.
 */
export function Countdown({
  target,
  resolved = false,
  label = "Resolves in",
}: {
  target: number; // unix seconds
  resolved?: boolean;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(t);
  }, []);

  if (resolved) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-yes/30 bg-yes/10 px-3 py-2 text-sm font-semibold text-yes">
        ✓ Resolved
      </div>
    );
  }

  const remaining = Math.max(0, target - now);
  if (remaining <= 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-lime/30 bg-lime/10 px-3 py-2 text-sm font-semibold text-lime">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
        </span>
        Resolving…
      </div>
    );
  }

  const { d, h, m, s } = parts(remaining);
  return (
    <div>
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="flex items-center gap-1.5">
        {d > 0 && <Seg value={String(d)} label={d === 1 ? "day" : "days"} />}
        <Seg value={pad(h)} label="hrs" />
        <Seg value={pad(m)} label="min" />
        <Seg value={pad(s)} label="sec" />
      </div>
    </div>
  );
}
