import "@testing-library/jest-dom";
import fs from "fs";
import path from "path";
import { useEffect } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SproutChat, SproutLauncher, SproutMascot, SproutProvider, SuggestedQuestions, useSprout } from "..";

const STARTERS = ["What's my debt-free date if I pay $200 more a month?"];

function renderSprout(extra = null) {
  return render(
    <SproutProvider scope={`test-${Math.random()}`} getContext={() => ({})}>
      <SproutLauncher />
      <SproutChat starters={STARTERS} />
      {extra}
    </SproutProvider>
  );
}

beforeEach(() => sessionStorage.clear());

test("launcher opens and closes the panel with correct ARIA state", async () => {
  renderSprout();
  const launcher = screen.getByRole("button", { name: /ask sprout/i });
  expect(launcher).toHaveAttribute("aria-expanded", "false");
  expect(launcher).toHaveAttribute("aria-controls", "sprout-panel");

  userEvent.click(launcher);
  const panel = screen.getByRole("dialog", { name: "Sprout" });
  expect(panel).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /close sprout, your ai money guide/i })).toHaveAttribute("aria-expanded", "true");
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Message Sprout" })).toHaveFocus());

  userEvent.click(within(panel).getByRole("button", { name: "Close Sprout" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Escape closes the panel and returns focus to the launcher", async () => {
  renderSprout();
  const launcher = screen.getByRole("button", { name: /ask sprout/i });
  userEvent.click(launcher);
  const input = await screen.findByRole("textbox", { name: "Message Sprout" });
  await waitFor(() => expect(input).toHaveFocus());
  userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
});

test("panel always shows the AI-guide disclaimer", () => {
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  expect(screen.getByText("AI guide, not a licensed advisor.")).toBeVisible();
});

test("a suggested question streams a reply with the calculator it used", async () => {
  renderSprout(<SuggestedQuestions questions={STARTERS} label="Page chips" />);
  const pageChips = screen.getByRole("group", { name: "Page chips" });
  userEvent.click(within(pageChips).getByRole("button", { name: STARTERS[0] }));

  const log = await screen.findByRole("list", { name: "Conversation with Sprout" });
  expect(within(log).getByText(STARTERS[0])).toBeInTheDocument();
  expect(await within(log).findByText("Debt payoff calculator", {}, { timeout: 3000 })).toBeInTheDocument();
  await waitFor(() => expect(log).toHaveTextContent(/debt-free around/i), { timeout: 5000 });
  // While streaming the Stop button is offered; afterwards Send returns.
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument(), { timeout: 5000 });
});

test("Enter sends and Shift+Enter adds a new line", async () => {
  renderSprout();
  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  const input = screen.getByRole("textbox", { name: "Message Sprout" });
  userEvent.type(input, "line one{shift}{enter}{/shift}line two");
  expect(input.value).toBe("line one\nline two");
  userEvent.type(input, "{enter}");
  expect(await screen.findByText(/line one/)).toBeInTheDocument();
  expect(input.value).toBe("");
});

test("messages over 1,000 characters are refused", async () => {
  let api;
  function Grab() {
    const ctx = useSprout();
    useEffect(() => {
      api = ctx;
    });
    return null;
  }
  renderSprout(<Grab />);
  let accepted;
  await act(async () => {
    accepted = await api.ask("x".repeat(1001));
  });
  expect(accepted).toBe(false);
  expect(screen.queryByRole("list", { name: "Conversation with Sprout" })).not.toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: /ask sprout/i }));
  expect(screen.getByRole("textbox", { name: "Message Sprout" })).toHaveAttribute("maxLength", "1000");
});

test("mascot is decorative unless given a label", () => {
  const { container } = render(
    <>
      <SproutMascot variant="full" />
      <SproutMascot variant="head" label="Sprout waving hello" mood="wave" />
    </>
  );
  expect(container.querySelector(".sp-mascot--full")).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByRole("img", { name: "Sprout waving hello" })).toHaveClass("sp-mascot--head", "sp-mascot--wave");
});

test("all Sprout animations are switched off for reduced motion", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "sprout.css"), "utf8");
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  expect(block).toMatch(/\.sp-mascot \*/);
  expect(block).toMatch(/animation: none !important/);
  expect(block).toMatch(/\.sp-panel/);
});

test("no browser code references the Anthropic API key", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(js|jsx|ts|tsx)$/.test(f.name) && !p.includes("__tests__")) {
        if (/ANTHROPIC|REACT_APP_ANTHROPIC|sk-ant-/.test(fs.readFileSync(p, "utf8"))) offenders.push(p);
      }
    }
  };
  walk(path.join(__dirname, "..", ".."));
  expect(offenders).toEqual([]);
});
