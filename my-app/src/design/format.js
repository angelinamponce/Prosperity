const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const money = (v) => whole.format(Math.round(v));

export function moneyShort(v) {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return `${sign}$${Math.round(a)}`;
}

export const pct = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export function duration(months) {
  if (!Number.isFinite(months)) return "never at this pace";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return `${m} mo`;
  return m ? `${y} yr ${m} mo` : `${y} yr`;
}
