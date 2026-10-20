import { useEffect, useRef, useState } from "react";

/**
 * A classic list menu with an arrow cursor. One tab stop; arrow keys move the cursor (in a grid when
 * `columns` > 1), Enter or Space chooses, Esc calls `onBack`. Touch and mouse work too.
 * items: [{ key, label, sub?, note?, disabled? }]. Disabled items stay readable, with their note.
 */
export function ListMenu({ items, columns = 1, onSelect, onBack, label, autoFocus = true, className = "" }) {
  const firstEnabled = Math.max(0, items.findIndex((i) => !i.disabled));
  const [cursor, setCursor] = useState(firstEnabled);
  const refs = useRef([]);

  useEffect(() => {
    setCursor(firstEnabled);
    if (autoFocus) refs.current[firstEnabled]?.focus({ preventScroll: true });
    // Re-run only when the set of items changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.key}:${i.disabled ? 1 : 0}`).join("|")]);

  const move = (to) => {
    const n = items.length;
    const i = ((to % n) + n) % n;
    setCursor(i);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e) => {
    const map = { ArrowDown: columns, ArrowUp: -columns, ArrowRight: 1, ArrowLeft: -1 };
    if (e.key in map) {
      if (columns === 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      e.preventDefault();
      move(cursor + map[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(items.length - 1);
    } else if (e.key === "Escape" && onBack) {
      e.preventDefault();
      e.stopPropagation();
      onBack();
    }
  };

  return (
    <div className={`lm ${className}`} role="menu" aria-label={label} style={{ "--cols": columns }} onKeyDown={onKeyDown}>
      {items.map((item, i) => (
        <button
          key={item.key}
          ref={(el) => (refs.current[i] = el)}
          type="button"
          role="menuitem"
          className={`lm__item${i === cursor ? " is-cursor" : ""}`}
          tabIndex={i === cursor ? 0 : -1}
          aria-disabled={item.disabled || undefined}
          onFocus={() => setCursor(i)}
          onMouseEnter={() => !item.disabled && setCursor(i)}
          onClick={() => !item.disabled && onSelect(item.key)}
        >
          <span className="lm__cursor" aria-hidden>▶</span>
          <span className="lm__body">
            <span className="lm__label">{item.label}</span>
            {item.sub && <span className="lm__sub">{item.sub}</span>}
            {item.note && <span className="lm__note">{item.note}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
