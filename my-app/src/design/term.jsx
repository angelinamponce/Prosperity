import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { QuestionOutlined } from "@ant-design/icons";

// A financial term with a small "what's this?" button that opens a plain-language explanation.
// Click or Enter/Space toggles it; Esc or clicking elsewhere closes it and returns focus to the button.
export function Term({ children, title, explain }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const id = useId();
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const name = title ?? (typeof children === "string" ? children : "this");

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

  // Keep the bubble inside the viewport on narrow screens.
  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    const r = popRef.current.getBoundingClientRect();
    const gutter = 12;
    if (r.left < gutter) setShift(gutter - r.left);
    else if (r.right > window.innerWidth - gutter) setShift(window.innerWidth - gutter - r.right);
  }, [open]);

  return (
    <span className="ps-term" ref={wrapRef}>
      {children}
      <button
        ref={btnRef}
        type="button"
        className="ps-term__btn"
        aria-label={`What's ${name.toLowerCase()}?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setShift(0);
          setOpen((o) => !o);
        }}
      >
        <QuestionOutlined aria-hidden />
      </button>
      {open && (
        <span ref={popRef} id={id} role="note" className="ps-term__pop" style={{ "--shift": `${shift}px` }}>
          <strong className="ps-term__title">{name}</strong>
          {explain}
        </span>
      )}
    </span>
  );
}
