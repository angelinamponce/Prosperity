import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { QuestionOutlined } from "@ant-design/icons";

// Shared by Term and Calc: a small bubble that opens from a button. Esc or clicking elsewhere closes it
// and returns focus to the button; the bubble shifts to stay inside the viewport on narrow screens.
function usePopover(onOpen) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    const r = popRef.current.getBoundingClientRect();
    const gutter = 12;
    if (r.left < gutter) setShift(gutter - r.left);
    else if (r.right > window.innerWidth - gutter) setShift(window.innerWidth - gutter - r.right);
  }, [open]);

  const toggle = () => {
    setShift(0);
    if (!open) onOpen?.();
    setOpen(!open);
  };
  return { open, id, wrapRef, btnRef, popRef, toggle, popStyle: { "--shift": `${shift}px` } };
}

// A financial term with a small "what's this?" button that opens a plain-language explanation.
// Click or Enter/Space toggles it. `onOpen` runs each time the explanation opens; `footer` renders under it.
export function Term({ children, title, explain, onOpen, footer }) {
  const p = usePopover(onOpen);
  const name = title ?? (typeof children === "string" ? children : "this");
  return (
    <span className="ps-term" ref={p.wrapRef}>
      {children}
      <button
        ref={p.btnRef}
        type="button"
        className="ps-term__btn"
        aria-label={`What's ${name.toLowerCase()}?`}
        aria-expanded={p.open}
        aria-controls={p.id}
        onClick={p.toggle}
      >
        <QuestionOutlined aria-hidden />
      </button>
      {p.open && (
        <span ref={p.popRef} id={p.id} role="note" className="ps-term__pop" style={p.popStyle}>
          <strong className="ps-term__title">{name}</strong>
          {explain}
          {footer}
        </span>
      )}
    </span>
  );
}

/**
 * A number you can tap to see how it was worked out ("advice that shows its work").
 * <Calc value="$2,200" title="Left over each month" calc="$6,250 income − $3,450 spending − $600 minimum payments" />
 */
export function Calc({ value, title, calc }) {
  const p = usePopover();
  return (
    <span className="ps-term ps-calc" ref={p.wrapRef}>
      <button
        ref={p.btnRef}
        type="button"
        className="ps-calc__btn"
        aria-expanded={p.open}
        aria-controls={p.id}
        aria-label={`${value}. Show how ${title.toLowerCase()} is worked out`}
        onClick={p.toggle}
      >
        {value}
      </button>
      {p.open && (
        <span ref={p.popRef} id={p.id} role="note" className="ps-term__pop" style={p.popStyle}>
          <strong className="ps-term__title">{title}</strong>
          {calc}
        </span>
      )}
    </span>
  );
}
