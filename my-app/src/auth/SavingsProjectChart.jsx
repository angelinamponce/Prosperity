import React from "react";
import Plot from "react-plotly.js";

const SavingsProjectionChart = ({ netCashFlow = 1200, houseGoal = 50000, currentSavings = 0 }) => {
  const months = Array.from({ length: 24 }, (_, i) => i + 1);
  const cumulativeSavings = months.map(m => currentSavings + netCashFlow * m);

  const traces = [
    {
      x: months,
      y: cumulativeSavings,
      type: "scatter",
      mode: "lines+markers",
      name: "💰 Projected Savings",
      line: { color: "#3498DB", width: 4 },
      fill: "tozeroy",
      fillcolor: "rgba(52, 152, 219, 0.2)",
      hovertemplate: `<b>Month %{x}</b><br>Cumulative Savings: $%{y:,.0f}<br>Monthly Addition: $${netCashFlow.toLocaleString()}<extra></extra>`
    },
  ];

  // Goal line
  const layout = {
    title: { text: "🚀 Interactive Savings Journey", x: 0.5 },
    shapes: [
      { type: "line", x0: 1, x1: 24, y0: houseGoal, y1: houseGoal, line: { color: "#E74C3C", width: 3, dash: "dash" } }
    ],
    annotations: [
      { x: 24, y: houseGoal, text: `🏠 House Goal: $${houseGoal.toLocaleString()}`, showarrow: false }
    ],
    xaxis: { title: "Months" },
    yaxis: { title: "Cumulative Savings ($)" },
    height: 500,
  };

  return <Plot data={traces} layout={layout} useResizeHandler style={{ width: "100%", height: "100%" }} />;
};

export default SavingsProjectionChart;
