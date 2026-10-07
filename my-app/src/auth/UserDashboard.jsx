import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppstoreOutlined, CreditCardOutlined, FlagOutlined, LineChartOutlined, QuestionCircleOutlined, RiseOutlined, SwapOutlined, UserOutlined } from "@ant-design/icons";
import { Button, LogoMark, Sprout } from "../design";
import { sampleProfile } from "../dashboard/sampleProfile";
import { computeMetrics } from "../dashboard/finance";
import { usePlan } from "../dashboard/usePlan";
import { useCurrentUser } from "../dashboard/useCurrentUser";
import { useUserFinances } from "../dashboard/useUserFinances";
import { useTutorial } from "../dashboard/tutorial/useTutorial";
import { tourSteps } from "../dashboard/tutorial/steps";
import { EmptyState, PageSkeleton } from "../dashboard/components";
import "../dashboard/dashboard.css";
import { SproutChat, SproutLauncher, SproutProvider } from "../sprout";

const Tour = lazy(() => import("../dashboard/tutorial/Tour"));

const SPROUT_STARTERS = [
  "What's my debt-free date if I pay $200 more a month?",
  "How much is my 401(k) match worth?",
  "Am I on track with my emergency fund?",
  "What should I focus on first?",
];

const PAGES = [
  { path: "", label: "Overview", icon: <AppstoreOutlined />, Component: lazy(() => import("../dashboard/pages/Overview")) },
  { path: "cash-flow", label: "Cash flow", icon: <SwapOutlined />, Component: lazy(() => import("../dashboard/pages/CashFlow")) },
  { path: "debt", label: "Debt", icon: <CreditCardOutlined />, Component: lazy(() => import("../dashboard/pages/Debt")) },
  { path: "invest", label: "Invest", icon: <LineChartOutlined />, Component: lazy(() => import("../dashboard/pages/Invest")) },
  { path: "future", label: "Future", icon: <RiseOutlined />, Component: lazy(() => import("../dashboard/pages/Future")) },
  { path: "goals", label: "Goals", icon: <FlagOutlined />, Component: lazy(() => import("../dashboard/pages/Goals")) },
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

function NewUserState({ onExplore }) {
  return (
    <EmptyState
      title="Let's grow your plan"
      action={
        <div className="db-empty__actions">
          <Link to="/signup" className="ps-btn ps-btn--primary">Finish my survey</Link>
          <Button variant="ghost" onClick={onExplore}>Explore with sample numbers</Button>
        </div>
      }
    >
      We don't have your income, savings or spending yet. The survey takes just a few minutes, and your dashboard fills in as soon as
      you're done.
    </EmptyState>
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
  const showPages = mode === "own" || mode === "sample";
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
  const navLinks = PAGES.map((p) => (
    <Link key={p.path} to={p.path ? `${BASE}/${p.path}` : BASE} aria-current={p === page ? "page" : undefined}>
      {p.icon}
      <span>{p.label}</span>
    </Link>
  ));
  const { Component } = page;

  return (
    <SproutProvider scope="app" getContext={() => ({ profile: showPages ? profile : null, plan })}>
      <div className="ps-root db" inert={(showPages && tutorial.open) || undefined}>
        <aside className="db-side">
          <Link to={BASE} className="db-brand">
            <LogoMark />
            Prosperity
          </Link>
          <nav className="db-nav" aria-label="Dashboard">{navLinks}</nav>
          <div className="db-side__foot">
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
            {mode === "empty" && <NewUserState onExplore={() => setExploringSample(true)} />}
            {mode === "error" && <LoadErrorState onRetry={finances.retry} onExplore={() => setExploringSample(true)} />}
            {showPages && (
              <Suspense fallback={<PageSkeleton />}>
                <div className="db-page" key={`${page.path}-${mode}`}>
                  <Component profile={profile} metrics={metrics} plan={plan} setPlan={setPlan} go={go} />
                </div>
              </Suspense>
            )}
          </div>
        </main>

        <nav className="db-tabbar" aria-label="Dashboard">{navLinks}</nav>
        <SproutLauncher />
        <SproutChat starters={SPROUT_STARTERS} />
      </div>
      {showPages && tutorial.open && (
        <Suspense fallback={null}>
          <Tour
            steps={steps}
            index={tutorial.step}
            currentPage={page.path}
            onNavigate={tourNavigate}
            onIndexChange={tutorial.setStep}
            onClose={tutorial.close}
          />
        </Suspense>
      )}
    </SproutProvider>
  );
}
