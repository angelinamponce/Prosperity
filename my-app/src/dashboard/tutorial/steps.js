// The first-visit dashboard tour. `page` is the dashboard sub-path the step lives on, and
// `target` matches a data-tour attribute there. Steps without a target show a centred card.
export function tourSteps(firstName) {
  return [
    {
      id: "welcome",
      page: "",
      title: firstName ? `Welcome to Prosperity, ${firstName}!` : "Welcome to Prosperity!",
      body: "Thanks for finishing the survey. Let's take a quick one-minute look around your new dashboard.",
    },
    {
      id: "grade",
      page: "",
      target: "grade",
      title: "Your financial health grade",
      body: "This is a friendly check-up on six everyday money habits. The amber bars show where a small change would help the most.",
    },
    {
      id: "cash-flow",
      page: "cash-flow",
      target: "cash-flow",
      title: "Where your money goes",
      body: "This chart follows your paycheck as it flows into each kind of spending, so you can see exactly what's left over at the end.",
    },
    {
      id: "trim",
      page: "cash-flow",
      target: "trim",
      title: "Try a small trim",
      body: "Slide this to see what trimming a little flexible spending could free up each month. It's only a what-if, so play freely.",
    },
    {
      id: "projection",
      page: "future",
      target: "projection",
      title: "Your savings projection",
      body: "Here's where your investments could be by retirement. The darker line is the most typical outcome, and the shading shows the range.",
    },
    {
      id: "controls",
      page: "future",
      target: "future-controls",
      title: "Make it yours",
      body: "Move these sliders to change how much you invest, your mix of stocks and bonds, and when you'd like to retire. Everything updates instantly.",
    },
    {
      id: "done",
      page: "",
      title: "You're all set!",
      body: "Tap any little ? to learn what a term means, or ask Sprout in the corner whenever you have a question. Want a refresher later? Choose \u201cReplay tutorial\u201d (or Help on your phone) anytime.",
    },
  ];
}
