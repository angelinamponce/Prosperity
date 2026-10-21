import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import BattleScreen from "../BattleScreen";
import { foeById } from "../foes";
import { BANK } from "../../quiz/bank";
import { resolveQuestion } from "../../quiz/session";
import { GameContext, gameKey, useGameStore } from "../../game/store";
import { XP, quizXp } from "../../game/rules";
import { sampleProfile } from "../../dashboard/sampleProfile";
import { computeMetrics } from "../../dashboard/finance";

const ctx = { profile: sampleProfile, metrics: computeMetrics(sampleProfile) };
const Q1 = resolveQuestion(BANK.find((q) => q.id === "debt-minimum-only"), ctx, 1);
const Q2 = resolveQuestion(BANK.find((q) => q.id === "debt-lower-apr"), ctx, 1);
const setup = { topic: "debt", foe: foeById("minimum-mite"), questions: [Q1, Q2] };

function Harness({ go, navigate = jest.fn(), query, battle = setup }) {
  const game = useGameStore("tester", { termKeys: [] });
  return (
    <GameContext.Provider value={game}>
      <span data-testid="xp">{game.progress.xp}</span>
      <BattleScreen profile={sampleProfile} metrics={ctx.metrics} go={go} navigate={navigate} query={query} setup={battle} />
    </GameContext.Provider>
  );
}

// Instant text keeps the test fast and matches what reduced-motion players see.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(gameKey("tester"), JSON.stringify({ settings: { instantText: true } }));
});

const menuItem = (name) => screen.getByRole("menuitem", { name: new RegExp(name, "i") });
// Presses Continue until a menu shows up (or the battle ends).
function continueToMenu() {
  for (let i = 0; i < 20 && !screen.queryByRole("menu"); i += 1) fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("menu")).toBeInTheDocument();
}
const answerWith = (text) => {
  fireEvent.click(menuItem("^Answer"));
  fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(text.slice(0, 20).replace(/[()]/g, ".")) }));
};

test("a full battle: help, a right answer, a wrong one that comes back, and befriending", () => {
  const go = jest.fn();
  render(<Harness go={go} />);

  // Intro and the Misconception's myth, each announced to screen readers.
  expect(screen.getByText(/Minimum Mite scuttled out/, { selector: ".ps-sr-only" })).toBeInTheDocument();
  continueToMenu();
  expect(screen.getByText("Strength 2/2")).toBeInTheDocument();
  ["Answer", "Toolshed", "Ask Sprout", "Leave"].forEach((n) => expect(menuItem(n)).toBeInTheDocument());

  // Ask Sprout rules out one wrong answer.
  fireEvent.click(menuItem("Ask Sprout"));
  expect(screen.getByText(/pretty sure it's not/, { selector: ".ps-sr-only" })).toBeInTheDocument();
  continueToMenu();
  fireEvent.click(menuItem("^Answer"));
  const out = screen.getAllByRole("menuitem").filter((b) => b.getAttribute("aria-disabled") === "true");
  expect(out).toHaveLength(1);
  expect(out[0]).toHaveTextContent("Sprout ruled this out");
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" }); // back to the command menu
  expect(menuItem("Toolshed")).toBeInTheDocument();

  // Right answer: strength drops and XP is paid at 75% for using one kind of help. It's also the first
  // right answer about its word, so the word is learned for the Garden Dex (+10).
  answerWith(Q1.choices[Q1.correct]);
  expect(screen.getByText("Strength 1/2")).toBeInTheDocument();
  expect(screen.getByTestId("xp")).toHaveTextContent(String(quizXp(Q1.difficulty, { sprout: true }) + XP.termLearned + 25)); // + Good Question badge
  let sawWord = false;
  for (let i = 0; i < 20 && !screen.queryByRole("menu"); i += 1) {
    sawWord ||= /New word for your Garden Dex: Minimum payment! \+10 XP/.test(document.body.textContent);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }
  expect(sawWord).toBe(true);

  // Wrong answer: no XP lost, and the question is promised back.
  const xpBefore = screen.getByTestId("xp").textContent;
  answerWith(Q2.choices[(Q2.correct + 1) % 4]);
  expect(screen.getByText(/wilts a little/, { selector: ".ps-sr-only" })).toBeInTheDocument();
  expect(screen.getByTestId("xp")).toHaveTextContent(xpBefore);
  continueToMenu();
  expect(screen.getByText("Strength 1/2")).toBeInTheDocument();

  // It comes back; answering it right befriends the Misconception.
  answerWith(Q2.choices[Q2.correct]);
  for (let i = 0; i < 20 && !screen.queryByRole("menuitem", { name: /battle again/i }); i += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }
  expect(screen.getByText(/You befriended Minimum Mite!/, { selector: ".tb__text *, .ps-sr-only" })).toBeTruthy();
  expect(screen.getByText("Strength 0/2")).toBeInTheDocument();
  // Befriending is saved for the Garden Dex.
  expect(JSON.parse(localStorage.getItem(gameKey("tester"))).quiz.befriended["minimum-mite"].times).toBe(1);
  fireEvent.click(screen.getByRole("menuitem", { name: /back to quizzes/i }));
  expect(go).toHaveBeenCalledWith("quiz");
});

test("menus work from the keyboard, and Leave exits with no penalty", () => {
  const go = jest.fn();
  render(<Harness go={go} />);
  continueToMenu();
  const answerBtn = menuItem("^Answer");
  answerBtn.focus();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowRight" });
  expect(menuItem("Toolshed")).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
  expect(menuItem("Leave")).toHaveFocus();
  fireEvent.click(menuItem("Leave"));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(go).toHaveBeenCalledWith("quiz");
  expect(screen.getByTestId("xp")).toHaveTextContent("0");
});

test("pause freezes the battle and offers instant text and leaving", () => {
  render(<Harness go={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /pause/i }));
  expect(screen.getByRole("menu", { name: "Pause menu" })).toBeInTheDocument();
  expect(menuItem("Instant text: On")).toBeInTheDocument();
  act(() => {
    fireEvent.click(menuItem("Resume"));
  });
  expect(screen.queryByRole("menu", { name: "Pause menu" })).not.toBeInTheDocument();
});

test("the landing page demo: one question, then sign-up or back home", () => {
  const go = jest.fn();
  const navigate = jest.fn();
  render(<Harness go={go} navigate={navigate} query={new URLSearchParams("demo=1")} battle={{ ...setup, questions: [Q1] }} />);
  expect(screen.getByText(/one-question practice battle/, { selector: ".ps-sr-only" })).toBeInTheDocument();
  continueToMenu();
  expect(screen.getByText("Strength 1/1")).toBeInTheDocument();
  answerWith(Q1.choices[Q1.correct]);
  for (let i = 0; i < 20 && !screen.queryByRole("menuitem", { name: /plant your first seed/i }); i += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }
  fireEvent.click(screen.getByRole("menuitem", { name: /plant your first seed/i }));
  expect(navigate).toHaveBeenCalledWith("/signup");
  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  expect(navigate).toHaveBeenCalledWith("/");
  expect(go).not.toHaveBeenCalled();
});

test("a level-up and a new badge are announced inside the battle", () => {
  localStorage.setItem(gameKey("tester"), JSON.stringify({ xp: 95, settings: { instantText: true } })); // 5 XP short of level 3
  render(<Harness go={jest.fn()} />);
  continueToMenu();
  answerWith(Q1.choices[Q1.correct]);
  const said = [];
  for (let i = 0; i < 20 && !screen.queryByRole("menu"); i += 1) {
    said.push(document.querySelector(".tb .ps-sr-only").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }
  expect(said).toContain("Sprout grew to level 3!");
  expect(said).toContain("You earned the Good Question badge!");
  expect(screen.getByText("Lv 3")).toBeInTheDocument();
});
