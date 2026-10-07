import "@testing-library/jest-dom";
import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tour from "../Tour";
import { tourSteps } from "../steps";
import { tutorialKey, useTutorial } from "../useTutorial";

// jsdom lacks these browser APIs.
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  window.scrollBy = () => {};
  window.scrollTo = () => {};
});
beforeEach(() => localStorage.clear());

function Harness({ uid = "user-1" }) {
  const tutorial = useTutorial({ ready: true, uid });
  const [page, setPage] = useState("");
  return (
    <>
      <button type="button" onClick={tutorial.replay}>Replay tutorial</button>
      <span data-testid="page">{page || "overview"}</span>
      {tutorial.open && (
        <Tour
          steps={tourSteps("Sam")}
          index={tutorial.step}
          currentPage={page}
          onNavigate={setPage}
          onIndexChange={tutorial.setStep}
          onClose={tutorial.close}
        />
      )}
    </>
  );
}

const key = (k) => act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));

test("opens automatically for a new user, greets them by name and takes focus", async () => {
  render(<Harness />);
  const dialog = await screen.findByRole("dialog", {}, { timeout: 2000 });
  expect(dialog).toHaveAccessibleName("Welcome to Prosperity, Sam!");
  expect(dialog).toHaveTextContent("Step 1 of 7");
  expect(dialog).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
});

test("arrow keys and Enter move between steps and switch dashboard pages", async () => {
  render(<Harness />);
  await screen.findByRole("dialog", {}, { timeout: 2000 });
  key("ArrowRight");
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Your financial health grade");
  key("Enter");
  expect(screen.getByRole("dialog")).toHaveTextContent("Step 3 of 7");
  await waitFor(() => expect(screen.getByTestId("page")).toHaveTextContent("cash-flow"));
  key("ArrowLeft");
  expect(screen.getByRole("dialog")).toHaveTextContent("Step 2 of 7");
  await waitFor(() => expect(screen.getByTestId("page")).toHaveTextContent("overview"));
});

test("Back, Next and the final step finish the tour and remember it", async () => {
  render(<Harness />);
  await screen.findByRole("dialog", {}, { timeout: 2000 });
  userEvent.click(screen.getByRole("button", { name: "Show me around" }));
  userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Step 1 of 7");
  for (let i = 0; i < 6; i++) key("ArrowRight");
  expect(screen.getByRole("dialog")).toHaveAccessibleName("You're all set!");
  expect(screen.queryByRole("button", { name: "Skip tour" })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole("button", { name: "Start exploring" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(localStorage.getItem(tutorialKey("user-1"))).toBe("done");
});

test("Esc skips, the tour stays closed on the next visit, and Replay brings it back", async () => {
  const { unmount } = render(<Harness />);
  await screen.findByRole("dialog", {}, { timeout: 2000 });
  key("Escape");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  unmount();

  render(<Harness />);
  await new Promise((r) => setTimeout(r, 1000));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Step 1 of 7");
});

test("each account has its own flag", async () => {
  localStorage.setItem(tutorialKey("user-1"), "done");
  render(<Harness uid="user-2" />);
  expect(await screen.findByRole("dialog", {}, { timeout: 2000 })).toBeInTheDocument();
});

test("Tab keeps focus inside the card", async () => {
  render(<Harness />);
  await screen.findByRole("dialog", {}, { timeout: 2000 });
  key("ArrowRight");
  const skip = screen.getByRole("button", { name: "Skip tour" });
  const next = screen.getByRole("button", { name: "Next" });
  act(() => next.focus());
  userEvent.tab();
  expect(skip).toHaveFocus();
  userEvent.tab({ shift: true });
  expect(next).toHaveFocus();
});
