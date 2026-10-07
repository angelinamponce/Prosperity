import { useSprout } from "./SproutProvider";

/** Question chips. Clicking one opens the panel and asks it. */
export default function SuggestedQuestions({ questions, label = "Ask Sprout", className = "" }) {
  const { ask, streaming } = useSprout();
  return (
    <div className={`sp-chips ${className}`} role="group" aria-label={label}>
      {questions.map((q) => (
        <button key={q} type="button" className="sp-chip" disabled={streaming} onClick={() => ask(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}
