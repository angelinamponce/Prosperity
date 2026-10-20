import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { currentStreak, emptyProgress, levelInfo, normalizeProgress, reduce, weekNumber } from "./rules";

// Progress lives in this browser, one save per signed-in account ("guest" per device without a session),
// the same approach as the dashboard tour. There is no Supabase table for it.
export const gameKey = (id) => `prosperity.game.v1.${id}`;

function load(id) {
  if (!id) return emptyProgress();
  try {
    return normalizeProgress(JSON.parse(localStorage.getItem(gameKey(id)) || "null"));
  } catch {
    return emptyProgress();
  }
}

function save(id, progress) {
  if (!id) return;
  try {
    localStorage.setItem(gameKey(id), JSON.stringify(progress));
  } catch {
    // Storage blocked (private mode): progress still counts for this visit.
  }
}

export const GameContext = createContext(null);

/** The game layer, or null outside a game screen (for example the landing page). */
export function useGame() {
  return useContext(GameContext);
}

/**
 * Owns the player's progress. `id` is the account uid, "guest", or null while sign-in is still loading
 * (actions are ignored until then). `termKeys` lists the dashboard's money words, for the Word Collector badge.
 */
export function useGameStore(id, { termKeys = [] } = {}) {
  const [progress, setProgress] = useState(() => load(id));
  const ref = useRef(progress);
  const loadedFor = useRef(id);
  // Which account's save is in `progress`. The game only reports ready once that matches, so nothing
  // ever acts on default settings during the moment between sign-in and loading the save.
  const [loadedId, setLoadedId] = useState(id);
  const [feed, setFeed] = useState([]);
  const ctx = useRef({ termKeys });
  ctx.current = { termKeys };

  // Switching accounts (or finishing sign-in) loads that account's save.
  useEffect(() => {
    if (loadedFor.current === id) return;
    loadedFor.current = id;
    ref.current = load(id);
    setProgress(ref.current);
    setLoadedId(id);
    setFeed([]);
  }, [id]);

  // Reads and writes go through the ref so a repeated action (React's dev double-run, a double tap)
  // sees the already-updated progress and awards nothing the second time.
  const dispatch = useCallback(
    (action) => {
      if (!id || loadedFor.current !== id) return;
      const res = reduce(ref.current, { ...action, at: Date.now() }, ctx.current);
      if (res.progress === ref.current) return;
      ref.current = res.progress;
      setProgress(res.progress);
      save(id, res.progress);
      if (res.events.length) setFeed((f) => [...f, { id: `${Date.now()}-${f.length}`, source: action.type, events: res.events }]);
    },
    [id]
  );

  const setSetting = useCallback(
    (key, value) => {
      if (!id) return;
      ref.current = { ...ref.current, settings: { ...ref.current.settings, [key]: value } };
      setProgress(ref.current);
      save(id, ref.current);
    },
    [id]
  );

  const learnTerm = useCallback((key, title) => dispatch({ type: "learnTerm", key, title }), [dispatch]);
  const checkIn = useCallback(() => dispatch({ type: "checkIn", week: weekNumber() }), [dispatch]);
  const takeFeed = useCallback((batchId) => setFeed((f) => f.filter((b) => b.id !== batchId)), []);

  return useMemo(
    () => ({
      id,
      ready: Boolean(id) && loadedId === id,
      progress,
      info: levelInfo(progress.xp),
      streakNow: currentStreak(progress.streak, weekNumber()),
      checkedInThisWeek: progress.streak.lastWeek === weekNumber(),
      dispatch,
      learnTerm,
      checkIn,
      setSetting,
      feed,
      takeFeed,
    }),
    [id, loadedId, progress, dispatch, learnTerm, checkIn, setSetting, feed, takeFeed]
  );
}
