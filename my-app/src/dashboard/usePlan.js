import { useEffect, useState } from "react";

const KEY = "prosperity.plan.v1";

// The what-if choices a user makes on the dashboard. Kept in this browser only.
export function usePlan(defaults) {
  const [plan, setPlanState] = useState(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(plan));
    } catch {
      // Storage can be unavailable (private mode); the plan still works for this visit.
    }
  }, [plan]);
  const setPlan = (patch) => setPlanState((p) => ({ ...p, ...patch }));
  return [plan, setPlan];
}
