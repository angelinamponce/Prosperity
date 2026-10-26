// In-memory sliding-window limits per key (an IP address). Fine for one server process; use a shared store if you run several.

export function createRateLimiter({ perMinute = 8, perDay = 80, now = () => Date.now() } = {}) {
  const hits = new Map(); // key -> timestamps within the last day
  const MINUTE = 60_000;
  const DAY = 24 * 60 * MINUTE;

  return {
    /** Records a hit and returns { ok: true } or { ok: false, retryAfter } in seconds. */
    take(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((h) => t - h < DAY);
      const lastMinute = recent.filter((h) => t - h < MINUTE);
      if (lastMinute.length >= perMinute) {
        hits.set(key, recent);
        return { ok: false, retryAfter: Math.ceil((lastMinute[0] + MINUTE - t) / 1000) };
      }
      if (recent.length >= perDay) {
        hits.set(key, recent);
        return { ok: false, retryAfter: Math.ceil((recent[0] + DAY - t) / 1000) };
      }
      recent.push(t);
      hits.set(key, recent);
      // Drop idle keys now and then so the map can't grow without bound.
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > DAY) hits.delete(k);
      return { ok: true };
    },
  };
}
