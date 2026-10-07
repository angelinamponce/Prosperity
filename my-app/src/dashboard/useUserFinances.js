import { useCallback, useEffect, useState } from "react";
import { supabase } from "../auth/supabaseClient";
import { hasFinancialRows, profileFromRows } from "./profileFromRows";

/**
 * Loads the signed-in user's own survey rows. The queries are the ones from the original
 * Dashboard.jsx: the Users row by auth_uid, then the latest Income, Savings and Spending rows
 * for that user's id. Read-only: nothing is written to Supabase.
 *
 * status: "idle" (no one signed in) | "loading" | "ready" | "empty" (signed in, no money rows yet) | "error"
 */
export function useUserFinances(uid) {
  const [state, setState] = useState({ status: uid ? "loading" : "idle", profile: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!uid) {
      setState({ status: "idle", profile: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ status: "loading", profile: null, error: null });

    (async () => {
      try {
        const { data: userRow, error: userErr } = await supabase
          .from("Users")
          .select("id, name, email, age, financial_goals")
          .eq("auth_uid", uid)
          .maybeSingle();
        if (userErr) throw userErr;
        if (!userRow?.id) {
          if (!cancelled) setState({ status: "empty", profile: null, error: null });
          return;
        }

        // Only this user's rows, newest first.
        const latest = (table) =>
          supabase.from(table).select("*").eq("user_id", userRow.id).order("id", { ascending: false }).limit(1).maybeSingle();
        const [incRes, savRes, spendRes] = await Promise.all([latest("Income"), latest("Savings"), latest("Spending")]);
        if (incRes.error) throw incRes.error;
        if (savRes.error) throw savRes.error;
        if (spendRes.error) throw spendRes.error;

        const rows = { user: userRow, income: incRes.data, savings: savRes.data, spending: spendRes.data };
        if (cancelled) return;
        if (!hasFinancialRows(rows)) setState({ status: "empty", profile: null, error: null });
        else setState({ status: "ready", profile: profileFromRows(rows), error: null });
      } catch (e) {
        console.error("Dashboard load error:", e);
        if (!cancelled) setState({ status: "error", profile: null, error: e?.message || "Something went wrong" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, attempt]);

  return { ...state, retry };
}
