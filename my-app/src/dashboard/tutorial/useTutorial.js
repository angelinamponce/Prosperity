import { useCallback, useEffect, useRef, useState } from "react";

// Completion is kept in this browser, one flag per signed-in account ("guest" without a session).
// There is no profiles table to hold it in Supabase; see the note in UserDashboard.
export const tutorialKey = (uid) => `prosperity.tutorial.v1.${uid ?? "guest"}`;

function readDone(key) {
  try {
    return localStorage.getItem(key) === "done";
  } catch {
    return false;
  }
}

function writeDone(key) {
  try {
    localStorage.setItem(key, "done");
  } catch {
    // Storage blocked (private mode): the tour won't reopen during this visit, but may on the next.
  }
}

// Opens the tour automatically the first time this account reaches the dashboard.
export function useTutorial({ ready, uid }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dismissed = useRef(false);
  const key = tutorialKey(uid);

  useEffect(() => {
    if (!ready || dismissed.current || readDone(key)) return undefined;
    // A short pause lets the overview paint first, so the tour doesn't flash over a blank page.
    const id = setTimeout(() => {
      setStep(0);
      setOpen(true);
    }, 700);
    return () => clearTimeout(id);
  }, [ready, key]);

  // Finishing, skipping and Esc all count as done: it only comes back through "Replay tutorial".
  const close = useCallback(() => {
    dismissed.current = true;
    writeDone(key);
    setOpen(false);
  }, [key]);

  const replay = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  return { open, step, setStep, close, replay };
}
