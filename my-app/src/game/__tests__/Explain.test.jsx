import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Explain } from "../../dashboard/glossary";
import { GameContext, gameKey, useGameStore } from "../store";

function Harness({ id = "test-user", children }) {
  const game = useGameStore(id, { termCount: 12 });
  return (
    <GameContext.Provider value={game}>
      <span data-testid="xp">{game.progress.xp}</span>
      {children}
    </GameContext.Provider>
  );
}

beforeEach(() => localStorage.clear());

test("opening a money word the first time earns XP once and says so", async () => {
  render(
    <Harness>
      <Explain k="apr" />
    </Harness>
  );
  const btn = screen.getByRole("button", { name: /what's apr/i });
  await userEvent.click(btn);
  expect(screen.getByText(/new word learned/i)).toBeInTheDocument();
  expect(screen.getByTestId("xp")).toHaveTextContent("10");

  await userEvent.click(btn); // close
  await userEvent.click(btn); // open again
  expect(screen.getByTestId("xp")).toHaveTextContent("10");
  expect(JSON.parse(localStorage.getItem(gameKey("test-user"))).terms).toEqual({ apr: true });
});

test("outside a game screen the word still explains itself, with no XP", async () => {
  render(<Explain k="apr" />);
  await userEvent.click(screen.getByRole("button", { name: /what's apr/i }));
  expect(screen.getByRole("note")).toHaveTextContent(/annual percentage rate/i);
  expect(screen.queryByText(/xp/i)).not.toBeInTheDocument();
});

test("each account keeps its own progress", async () => {
  localStorage.setItem(gameKey("a"), JSON.stringify({ xp: 70 }));
  const { rerender } = render(<Harness id="a" />);
  expect(screen.getByTestId("xp")).toHaveTextContent("70");
  await act(async () => rerender(<Harness id="b" />));
  expect(screen.getByTestId("xp")).toHaveTextContent("0");
});
