import React from "react";
import Plot from "react-plotly.js";

const defaultSarahData = {
  salary: 85000 / 12,
  freelance: 8000 / 12,
  dividends: 1200 / 12,
  rent: -1800,
  utilities: -(120 + 45 + 35 + 65 + 35),
  insurance: -(220 + 95 + 65),
  debt_payments: -(425 + 180 + 295),
  phone: -85,
  gym: -65,
  subscriptions: -25,
  groceries: -(110 * 4.33),
  dining_out: -(30 * 4.33),
  gas_transport: -(45 * 4.33),
};

const CashFlowBarChart = ({ userData, userName = "Your" }) => {
  const sarahData = userData ?? defaultSarahData;

  const incomeCategories = ["Salary", "Freelance", "Investment Income"];
  const incomeAmounts = [
    sarahData.salary,
    sarahData.freelance,
    sarahData.dividends,
  ];

  const expenseCategories = [
    "Housing (Rent + Utilities)",
    "Insurance",
    "Debt Payments",
    "Food (Groceries + Dining)",
    "Transportation",
    "Other (Phone, Gym, Subscriptions)",
  ];
  const expenseAmounts = [
    sarahData.rent + sarahData.utilities,
    sarahData.insurance,
    sarahData.debt_payments,
    sarahData.groceries + sarahData.dining_out,
    sarahData.gas_transport,
    sarahData.phone + sarahData.gym + sarahData.subscriptions + (sarahData.others ?? 0),
  ];

  const totalIncome = incomeAmounts.reduce((a, b) => a + b, 0);
  const totalExpenses = expenseAmounts.reduce((a, b) => a + b, 0);
  const netCashFlow = totalIncome + totalExpenses;

  // --- Build Traces ---
  const incomeTrace = {
    name: "💰 Income",
    y: incomeCategories,
    x: incomeAmounts,
    orientation: "h",
    type: "bar",
    marker: {
      color: ["#27AE60", "#2ECC71", "#58D68D"].slice(0, incomeCategories.length),
      line: { color: "white", width: 2 },
    },
    hovertemplate:
      "<b>%{y}</b><br>Amount: $%{x:,.0f}<br>Type: Income<br><extra></extra>",
    text: incomeAmounts.map((x) => `$${x.toFixed(0)}`),
    textfont: { color: "white", size: 12, family: "Times New Roman" },
  };

  const expenseTrace = {
    name: "💸 Expenses",
    y: expenseCategories,
    x: expenseAmounts,
    orientation: "h",
    type: "bar",
    marker: {
      color: [
        "#E74C3C",
        "#EC7063",
        "#F1948A",
        "#F5B7B1",
        "#FADBD8",
        "#FDEDEC",
      ].slice(0, expenseCategories.length),
      line: { color: "white", width: 2 },
    },
    hovertemplate:
      "<b>%{y}</b><br>Amount: $%{x:,.0f}<br>Type: Expense<br>Absolute Value: $%{customdata:,.0f}<br><extra></extra>",
    customdata: expenseAmounts.map((x) => Math.abs(x)),
    text: expenseAmounts.map((x) => `$${Math.abs(x).toFixed(0)}`),
    textfont: { color: "white", size: 12, family: "Times New Roman" },
  };

  // --- Layout ---
  const layout = {
    title: {
      text: `💼 ${userName}'s Monthly Cash Flow Analysis<br><sub>Hover over bars for detailed information</sub>`,
      font: { size: 20, family: "Times New Roman", color: "#2C3E50" },
      x: 0.5,
    },
    xaxis: {
      title: "Monthly Amount ($)",
      titlefont: { size: 14, family: "Times New Roman", color: "#2C3E50" },
      tickformat: "$,.0f",
      gridcolor: "#E5E5E5",
      zeroline: true,
      zerolinecolor: "#2C3E50",
      zerolinewidth: 2,
    },
    yaxis: {
      titlefont: { size: 14, family: "Times New Roman", color: "#2C3E50" },
      tickfont: { size: 11, family: "Times New Roman" },
    },
    plot_bgcolor: "white",
    paper_bgcolor: "#F8F9FA",
    font: { family: "Times New Roman" },
    hovermode: "y unified",
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "right",
      x: 1,
      font: { size: 12, family: "Times New Roman" },
    },
    height: 600,
    annotations: [
      {
        x: 0.02,
        y: 0.98,
        xref: "paper",
        yref: "paper",
        text: `📊 Summary:<br>Monthly Income: $${totalIncome.toFixed(
          0
        )} | Monthly Expenses: $${Math.abs(
          totalExpenses
        ).toFixed(0)}<br>Net Cash Flow: $${netCashFlow.toFixed(
          0
        )}<br>Savings Rate: ${((netCashFlow / totalIncome) * 100).toFixed(1)}%`,
        showarrow: false,
        align: "left",
        bgcolor: "lightblue",
        bordercolor: "#3498DB",
        borderwidth: 2,
        font: { size: 10, family: "Times New Roman" },
      },
    ],
  };

  return <Plot data={[incomeTrace, expenseTrace]} layout={layout} />;
};

export default CashFlowBarChart;
