import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { Button, Sprout, prefersReducedMotion } from "../../design";
import "./tour.css";

const PAD = 8; // breathing room between the target and the spotlight edge
const GAP = 14; // space between the spotlight and the card
const EDGE = 12; // closest the card may sit to the viewport edge
const SHEET_BELOW = 640; // narrower screens always dock the card to the bottom
const FIND_TIMEOUT = 4000; // give up on a missing target and show a centred card instead

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const sameRect = (a, b, target) =>
  a && a.target === target && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

// First side (below, above, right, left) where the whole card fits beside the spotlight, or null.
function placeCard(r, card, vw, vh) {
  const top = r.top - PAD;
  const bottom = r.top + r.height + PAD;
  const left = r.left - PAD;
  const right = r.left + r.width + PAD;
  const x = clamp(r.left + r.width / 2 - card.w / 2, EDGE, vw - card.w - EDGE);
  const y = clamp(r.top + r.height / 2 - card.h / 2, EDGE, vh - card.h - EDGE);
  if (card.w + 2 * EDGE > vw) return null;
  const options = [
    { fits: bottom + GAP + card.h <= vh - EDGE, top: bottom + GAP, left: x },
    { fits: top - GAP - card.h >= EDGE, top: top - GAP - card.h, left: x },
    { fits: right + GAP + card.w <= vw - EDGE, top: y, left: right + GAP },
    { fits: left - GAP - card.w >= EDGE, top: y, left: left - GAP - card.w },
  ];
  return options.find((o) => o.fits) ?? null;
}

// Scrolls so the target sits in the part of the screen not covered by the sticky top bar or a docked card.
function scrollToTarget(el, reservedBottom, behavior) {
  const r = el.getBoundingClientRect();
  const topbar = document.querySelector(".db-topbar")?.getBoundingClientRect().height || 0;
  const free = window.innerHeight - topbar - reservedBottom;
  const offset = r.height + 2 * PAD <= free ? (free - r.height) / 2 : PAD + 8;
  window.scrollBy({ top: r.top - topbar - offset, behavior });
}

export default function Tour({ steps, index, currentPage, onNavigate, onIndexChange, onClose }) {
  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  // Last measured target box, tagged with its step's target so a stale box is never mistaken for the current one.
  const [rect, setRect] = useState(null);
  const [missing, setMissing] = useState(false);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [card, setCard] = useState({ w: 360, h: 220 });
  const cardRef = useRef(null);
  const cardSize = useRef(card);
  cardSize.current = card;
  const id = useId();
  const reduced = prefersReducedMotion();
  const narrow = viewport.w < SHEET_BELOW;

  const next = () => (isLast ? onClose() : onIndexChange(index + 1));
  const back = () => !isFirst && onIndexChange(index - 1);

  // Each step lives on a dashboard page; go there first.
  useEffect(() => {
    if (step.page !== currentPage) onNavigate(step.page);
  }, [step.page, currentPage, onNavigate]);

  // Find the step's element (its page may still be loading), scroll it into view, then follow it every frame
  // so the spotlight stays put through page animations, resizes and scrolling.
  useEffect(() => {
    setMissing(false);
    if (!step.target) return undefined;
    const behavior = reduced ? "auto" : "smooth";
    // Room a bottom-docked card takes up, which the target should stay clear of.
    const sheetRoom = () => cardSize.current.h + 2 * EDGE;
    const started = performance.now();
    let foundAt = 0;
    let rescrolled = false;
    let raf;
    const tick = (now) => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) {
        if (now - started > FIND_TIMEOUT) {
          setMissing(true);
          return;
        }
      } else {
        if (!foundAt) {
          foundAt = now;
          scrollToTarget(el, window.innerWidth < SHEET_BELOW ? sheetRoom() : 0, behavior);
        } else if (!rescrolled && now - foundAt > 700) {
          // Once the scroll and the page's own entrance animation settle, check the target is clear of the
          // top bar and of a docked card (charts size themselves after mounting, and big targets dock the card).
          rescrolled = true;
          const r = el.getBoundingClientRect();
          const docked = window.innerWidth < SHEET_BELOW || !placeCard(r, cardSize.current, window.innerWidth, window.innerHeight);
          const reserved = docked ? sheetRoom() : 0;
          const topbar = document.querySelector(".db-topbar")?.getBoundingClientRect().height || 0;
          const fits = r.height + 2 * PAD <= window.innerHeight - topbar - reserved;
          const clipped = r.top < topbar || (fits && r.bottom + PAD > window.innerHeight - reserved);
          if (clipped) scrollToTarget(el, reserved, behavior);
        }
        const r = el.getBoundingClientRect();
        setRect((prev) => (sameRect(prev, r, step.target) ? prev : { target: step.target, top: r.top, left: r.left, width: r.width, height: r.height }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.target, reduced]);

  // Extra room at the bottom of the page so targets near the end can scroll clear of a docked card.
  useEffect(() => {
    document.documentElement.classList.add("tour-open");
    return () => document.documentElement.classList.remove("tour-open");
  }, []);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Measure the card so it can be placed beside the spotlight without overflowing the screen.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return undefined;
    const measure = () => setCard((c) => (c.w === el.offsetWidth && c.h === el.offsetHeight ? c : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);

  // Move focus into the card on every step (the card remounts per step, so screen readers announce it),
  // and hand focus back to wherever it was when the tour closes.
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement && previous !== document.body) previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Keyboard: → or Enter for next, ← for back, Esc to skip, and Tab stays inside the card.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        // Enter on a focused button already presses it.
        e.preventDefault();
        next();
      } else if (e.key === "Tab" && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll("button:not([disabled])")];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === cardRef.current || !cardRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !cardRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const wantsSpot = Boolean(step.target) && !missing;
  const spotlit = wantsSpot && rect?.target === step.target;
  const placement = spotlit && !narrow ? placeCard(rect, card, viewport.w, viewport.h) : null;
  // "pending": the target's page is still loading, so the card waits (invisible) instead of jumping around.
  const mode = spotlit ? (placement ? "float" : "sheet") : wantsSpot ? "pending" : "center";

  // While the next target loads, the spotlight holds its previous position, then glides over.
  const spotStyle =
    wantsSpot && rect
      ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
      : { top: viewport.h / 2, left: viewport.w / 2, width: 0, height: 0 };

  return createPortal(
    <div className={`tour${reduced ? " tour--still" : ""}`}>
      {/* Catches clicks on the dimmed page; the dashboard itself is inert while the tour is open. */}
      <div className="tour__blocker" aria-hidden />
      <div className={`tour__spot${spotlit ? "" : " is-empty"}`} style={spotStyle} aria-hidden />

      <div
        key={step.id}
        ref={cardRef}
        className={`tour__card tour__card--${mode}`}
        style={mode === "float" ? { top: placement.top, left: placement.left } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-progress ${id}-body`}
        tabIndex={-1}
      >
        {!step.target && <Sprout size={44} className="ps-sprout--sway tour__sprout" />}
        <p className="tour__progress" id={`${id}-progress`}>
          <span>
            Step {index + 1} of {steps.length}
          </span>
          <span className="tour__dots" aria-hidden>
            {steps.map((s, i) => (
              <span key={s.id} className={i === index ? "is-current" : i < index ? "is-done" : ""} />
            ))}
          </span>
        </p>
        <h2 className="tour__title" id={`${id}-title`}>
          {step.title}
        </h2>
        <p className="tour__body" id={`${id}-body`}>
          {step.body}
        </p>
        <div className="tour__actions">
          {!isLast && (
            <Button variant="ghost" size="sm" onClick={onClose} className="tour__skip">
              Skip tour
            </Button>
          )}
          <span className="tour__spacer" />
          {!isFirst && (
            <Button variant="secondary" size="sm" icon={<ArrowLeftOutlined />} onClick={back}>
              Back
            </Button>
          )}
          <Button size="sm" iconRight={isLast ? null : <ArrowRightOutlined />} onClick={next}>
            {isFirst ? "Show me around" : isLast ? "Start exploring" : "Next"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
