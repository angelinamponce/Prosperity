import { useEffect, useState } from "react";
import { supabase } from "../auth/supabaseClient";

// Who is signed in, and the name they gave in the survey. Read-only: this never writes to Supabase.
// `uid` is null for visitors without a session, who see the sample profile.
export function useCurrentUser() {
  const [user, setUser] = useState({ ready: false, uid: null, name: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let uid = null;
      let name = null;
      try {
        const { data } = await supabase.auth.getUser();
        uid = data?.user?.id ?? null;
        if (uid) {
          const { data: row } = await supabase.from("Users").select("name").eq("auth_uid", uid).maybeSingle();
          name = row?.name?.trim() || null;
        }
      } catch {
        // Offline or misconfigured: fall back to the sample profile rather than blocking the dashboard.
      }
      if (!cancelled) setUser({ ready: true, uid, name });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
