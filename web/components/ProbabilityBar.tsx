import { priceToPct } from "@/lib/format";
import { PRICE_SCALE } from "@robinmarkets/shared";

/** Horizontal YES/NO split bar. `price` is the YES price (1e18). */
export function ProbabilityBar({ price }: { price: bigint }) {
  const yesPct = Number((price * 100n) / PRICE_SCALE);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className="text-yes">Yes {priceToPct(price)}</span>
        <span className="text-no">No {priceToPct(PRICE_SCALE - price)}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-yes" style={{ width: `${yesPct}%` }} />
        <div className="h-full bg-no" style={{ width: `${100 - yesPct}%` }} />
      </div>
    </div>
  );
}
