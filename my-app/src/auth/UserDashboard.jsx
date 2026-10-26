import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AppstoreOutlined, CreditCardOutlined, FlagOutlined, FormOutlined, LineChartOutlined, QuestionCircleOutlined, RiseOutlined, SwapOutlined, TrophyOutlined, UserOutlined } from "@ant-design/icons";
import { Button, LogoMark, Sprout } from "../design";
import { sampleProfile } from "../dashboard/sampleProfile";
import { computeMetrics } from "../dashboard/finance";
import { usePlan } from "../dashboard/usePlan";
import { useCurrentUser } from "../dashboard/useCurrentUser";
import { useUserFinances } from "../dashboard/useUserFinances";
import { useTutorial } from "../dashboard/tutorial/useTutorial";
import { tourSteps } from "../dashboard/tutorial/steps";
import { EmptyState, PageSkeleton } from "../dashboard/components";
import { FirstStep } from "../dashboard/home/HomeTop";
import "../dashboard/dashboard.css";
import { SproutChat, SproutLauncher, SproutProvider } from "../sprout";
import { GameContext, GameFeed, GardenerChip, useGameStore } from "../game";
import { DASHBOARD_TERMS } from "../dashboard/glossary";

const Tour = lazy(() => import("../dashboard/tutorial/Tour"));

const SPROUT_STARTERS = [
  "How fast can I pay off my debt?",
  "Is my emergency fund enough?",
  "How much should I put in my 401(k)?",
];

const PAGES = [
  { path: "", label: "Overview", icon: <AppstoreOutlined />, Component: lazy(() => import("../dashboard/pages/Overview")) },
  { path: "cash-flow", label: "Cash flow", icon: <SwapOutlined />, Component: lazy(() => import("../dashboard/pages/CashFlow")) },
  { path: "debt", label: "Debt", icon: <CreditCardOutlined />, Component: lazy(() => import("../dashboard/pages/Debt")) },
  { path: "invest", label: "Invest", icon: <LineChartOutlined />, Component: lazy(() => import("../dashboard/pages/Invest")) },
  { path: "future", label: "Future", icon: <RiseOutlined />, Component: lazy(() => import("../dashboard/pages/Future")) },
  { path: "goals", label: "Goals", icon: <FlagOutlined />, Component: lazy(() => import("../dashboard/pages/Goals")) },
  { path: "quiz", label: "Quizzes", icon: <FormOutlined />, dataFree: true, Component: lazy(() => import("../dashboard/pages/Quiz")) },
  // Garden mode: the town. Full screen, reached from the "Play in Garden mode" switch.
  { path: "garden", label: "Garden mode", nav: false, tab: false, fullscreen: true, dataFree: true, Component: lazy(() => import("../world/GardenWorld")) },
  // Full screen, reached from the Quizzes page rather than the nav.
  { path: "battle", label: "Quiz battle", nav: false, tab: false, fullscreen: true, Component: lazy(() => import("../battle/BattleScreen")) },
  // Not in the phone tab bar (it would be crowded); the level chip in the top bar links here instead.
  { path: "progress", label: "Progress", icon: <TrophyOutlined />, tab: false, dataFree: true, Component: lazy(() => import("../dashboard/pages/Progress")) },
];

const BASE = "/app/individual";

function LoadingState() {
  return (
    <div role="status" aria-live="polite">
      <div className="db-loading">
        <Sprout size={44} className="ps-sprout--sway" />
        <p className="ps-body">Gathering your numbers…</p>
      </div>
      <PageSkeleton />
    </div>
  );
}

function LoadErrorState({ onRetry, onExplore }) {
  return (
    <EmptyState
      title="We couldn't load your numbers"
      action={
        <div className="db-empty__actions">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="ghost" onClick={onExplore}>Explore with sample numbers</Button>
        </div>
      }
    >
      That's usually a brief connection hiccup, and your answers are safe. Give it another try in a moment.
    </EmptyState>
  );
}

export default function UserDashboard() {
  const { "*": sub = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // Unknown sub-paths (including /first-time after sign-up) show the overview.
  const page = PAGES.find((p) => p.path === sub) ?? PAGES[0];

  const user = useCurrentUser();
  const finances = useUserFinances(user.uid);
  const [exploringSample, setExploringSample] = useState(false);

  // Signed-in users see their own survey numbers; visitors (or anyone who chooses to explore) see the sample.
  let mode;
  if (!user.ready) mode = "loading";
  else if (!user.uid || exploringSample) mode = "sample";
  else if (finances.status === "ready") mode = "own";
  else if (finances.status === "empty" || finances.status === "error") mode = finances.status;
  else mode = "loading";

  const ownProfile = finances.profile;
  const profile = useMemo(
    () =>
      mode === "own" && ownProfile
        ? ownProfile
        : { ...sampleProfile, name: user.uid ? user.name ?? "" : sampleProfile.name },
    [mode, ownProfile, user.uid, user.name]
  );
  // The tour walks through charts, so it waits until there are numbers to show.
  const tourAllowed = mode === "own" || mode === "sample";
  // Quizzes and Progress don't need survey numbers, so they work before the survey too.
  const showPages = mode === "own" || mode === "sample" || (mode === "empty" && Boolean(page.dataFree));
  const metrics = useMemo(() => computeMetrics(profile), [profile]);
  const [plan, setPlan] = usePlan({
    extraDebt: 300,
    strategy: "avalanche",
    trim: 0,
    monthlyInvest: 800,
    investYears: 30,
    stockShare: 0.8,
    retireAge: profile.retirementAge,
  });

  // First-visit tour. Completion is stored in localStorage per account: there is no profiles table
  // in Supabase to hold a has_completed_tutorial flag, and the schema is left unchanged.
  const tutorial = useTutorial(user);
  const steps = useMemo(() => tourSteps(profile.name.split(" ")[0]), [profile.name]);

  // XP, badges and streak, saved per account (per device for visitors). Waits until sign-in is known.
  const game = useGameStore(user.ready ? user.uid ?? "guest" : null, { termKeys: DASHBOARD_TERMS });
  const { checkIn, dispatch } = game;
  // Opening the dashboard is the weekly check-in; repeat visits in the same week change nothing.
  // Full-screen pages (like the landing page's demo battle) don't count as a visit.
  const fullscreen = Boolean(page.fullscreen);
  useEffect(() => {
    if (game.ready && !fullscreen) checkIn();
  }, [game.ready, fullscreen, checkIn]);
  // Only the user's own survey answers count, not exploring the sample.
  useEffect(() => {
    if (game.ready && mode === "own") dispatch({ type: "surveyDone" });
  }, [game.ready, mode, dispatch]);
  // Someone who chose Garden mode opens into it, but only when first arriving on the Overview. Direct links
  // (and places entered from town) always show the Classic page. Classic View is the default.
  const viewChecked = useRef(false);
  useEffect(() => {
    if (!game.ready || viewChecked.current) return;
    viewChecked.current = true;
    if (page.path === "" && game.progress.settings.view === "garden") navigate(`${BASE}/garden`, { replace: true });
  }, [game.ready, game.progress.settings.view, page.path, navigate]);

  // Finishing the last step earns XP; skipping simply closes the tour.
  const closeTour = () => {
    if (tutorial.step >= steps.length - 1) dispatch({ type: "tourDone" });
    tutorial.close();
  };
  const tourNavigate = useCallback(
    (path) => {
      navigate(path ? `${BASE}/${path}` : BASE);
      window.scrollTo(0, 0);
    },
    [navigate]
  );
  const replayButton = (
    <button type="button" className="db-help" onClick={tutorial.replay}>
      <QuestionCircleOutlined aria-hidden />
      <span>Replay tutorial</span>
    </button>
  );

  const go = (path) => {
    navigate(path ? `${BASE}/${path}` : BASE);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const initials = profile.name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatar = <span className="db-avatar" aria-hidden>{initials || <UserOutlined />}</span>;
  const navLink = (p) => (
    <Link key={p.path} to={p.path ? `${BASE}/${p.path}` : BASE} aria-current={p === page ? "page" : undefined}>
      {p.icon}
      <span>{p.label}</span>
    </Link>
  );
  const { Component } = page;

  // Garden-mode screens (Quiz Battles) take over the whole window, with no sidebar or tab bar.
  if (page.fullscreen) {
    return (
      <GameContext.Provider value={game}>
        <SproutProvider scope="app" getContext={() => ({ profile, plan })}>
          <Suspense fallback={<div className="ps-root"><PageSkeleton /></div>}>
            <Component profile={profile} metrics={metrics} plan={plan} setPlan={setPlan} go={go} navigate={navigate} query={new URLSearchParams(location.search)} />
          </Suspense>
          <GameFeed quiet={page.path === "battle"} />
        </SproutProvider>
      </GameContext.Provider>
    );
  }

  return (
    <GameContext.Provider value={game}>
      <SproutProvider scope="app" getContext={() => ({ profile: showPages ? profile : null, plan })}>
        <div className="ps-root db" inert={(tourAllowed && tutorial.open) || undefined}>
          <aside className="db-side">
            <Link to={BASE} className="db-brand">
              <LogoMark />
              Prosperity
            </Link>
            <nav className="db-nav" aria-label="Dashboard">{PAGES.filter((p) => p.nav !== false).map(navLink)}</nav>
            <div className="db-side__foot">
              <GardenerChip to={`${BASE}/progress`} />
              {replayButton}
              {mode === "own" ? (
                <p className="db-note">🌱 These numbers come from your survey answers.</p>
              ) : mode === "sample" && user.uid ? (
                <p className="db-note">
                  🌱 You're exploring sample numbers.{" "}
                  <button type="button" className="db-note__link" onClick={() => setExploringSample(false)}>
                    Back to my plan
                  </button>
                </p>
              ) : (
                <p className="db-note">🌱 For now you're seeing example numbers so you can play around safely. Your own will appear here once you sign in and finish the survey.</p>
              )}
              <div className="db-user">
                {avatar}
                <div>
                  <div className="db-user__name">{profile.name || "Welcome!"}</div>
                  <div className="db-user__meta">{!user.uid ? "Exploring the demo" : mode === "sample" ? "Exploring sample numbers" : "Your plan"}</div>
                </div>
              </div>
            </div>
          </aside>

          <header className="db-topbar">
            <Link to={BASE} className="db-brand" style={{ padding: 0 }}>
              <LogoMark size={26} />
              Prosperity
            </Link>
            <div className="db-topbar__end">
              <GardenerChip to={`${BASE}/progress`} compact />
              <button type="button" className="db-help db-help--icon" onClick={tutorial.replay} aria-label="Help: replay tutorial" title="Replay tutorial">
                <QuestionCircleOutlined aria-hidden />
                <span>Help</span>
              </button>
              {avatar}
            </div>
          </header>

          <main className="db-main">
            <div className="db-content">
              {mode === "loading" && <LoadingState />}
              {mode === "empty" && !showPages && <FirstStep onExplore={() => setExploringSample(true)} onQuiz={() => go("quiz")} />}
              {mode === "error" && <LoadErrorState onRetry={finances.retry} onExplore={() => setExploringSample(true)} />}
              {showPages && (
                <Suspense fallback={<PageSkeleton />}>
                  <div className="db-page" key={`${page.path}-${mode}`}>
                    <Component profile={profile} metrics={metrics} plan={plan} setPlan={setPlan} go={go} onReplayTour={tutorial.replay} />
                  </div>
                </Suspense>
              )}
            </div>
          </main>

          <nav className="db-tabbar" aria-label="Dashboard">{PAGES.filter((p) => p.nav !== false && p.tab !== false).map(navLink)}</nav>
          <SproutLauncher />
          <SproutChat starters={SPROUT_STARTERS} />
        </div>
        <GameFeed />
        {tourAllowed && tutorial.open && (
          <Suspense fallback={null}>
            <Tour
              steps={steps}
              index={tutorial.step}
              currentPage={page.path}
              onNavigate={tourNavigate}
              onIndexChange={tutorial.setStep}
              onClose={closeTour}
            />
          </Suspense>
        )}
      </SproutProvider>
    </GameContext.Provider>
  );
}
