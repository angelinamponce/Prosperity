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

const FinancialGradeChart = ({ userData, userName = "Your" }) => {
  const sarahData = userData ?? defaultSarahData;

  const incomeAmounts = [
    sarahData.salary,
    sarahData.freelance,
    sarahData.dividends,
  ];
  const totalIncome = incomeAmounts.reduce((a, b) => a + b, 0);
  const totalExpenses =
    sarahData.rent +
    sarahData.utilities +
    sarahData.insurance +
    sarahData.debt_payments +
    sarahData.groceries +
    sarahData.dining_out +
    sarahData.gas_transport +
    sarahData.phone +
    sarahData.gym +
    sarahData.subscriptions +
    (sarahData.others ?? 0);

  const netCashFlow = totalIncome + totalExpenses;

  // --- Financial Grade Calculation ---
  function calculateFinancialGrade(income, expenses, netFlow) {
    const savingsRate = income > 0 ? (netFlow / income) * 100 : 0;
    let grade = 0;

    // Savings Rate (40%)
    if (savingsRate >= 30) grade += 40;
    else if (savingsRate >= 20) grade += 32;
    else if (savingsRate >= 15) grade += 24;
    else if (savingsRate >= 10) grade += 16;
    else grade += savingsRate * 1.6;

    // Emergency Fund Potential (20%)
    const emergencyFundMonths =
      expenses !== 0 ? netFlow / (Math.abs(expenses) / 12) : 0;
    if (emergencyFundMonths >= 6) grade += 20;
    else if (emergencyFundMonths >= 3) grade += 15;
    else if (emergencyFundMonths >= 1) grade += 10;
    else grade += emergencyFundMonths * 10;

    // Debt-to-Income (20%)
    const debtPayments = Math.abs(sarahData.debt_payments);
    const debtRatio = (debtPayments / income) * 100;
    if (debtRatio <= 10) grade += 20;
    else if (debtRatio <= 20) grade += 15;
    else if (debtRatio <= 30) grade += 10;
    else grade += Math.max(0, 20 - (debtRatio - 10));

    // Income Diversity (20%)
    const primaryIncome = Math.max(...incomeAmounts);
    const incomeDiversity = ((income - primaryIncome) / income) * 100;
    if (incomeDiversity >= 20) grade += 20;
    else if (incomeDiversity >= 10) grade += 15;
    else grade += incomeDiversity * 1.5;

    return Math.min(100, Math.max(0, grade));
  }

  function getGradeColor(grade) {
    if (grade >= 80) return "#27AE60"; // Green
    if (grade >= 60) return "#F1C40F"; // Yellow
    return "#E74C3C"; // Red
  }

  const grade = calculateFinancialGrade(
    totalIncome,
    totalExpenses,
    netCashFlow
  );
  const gradeColor = getGradeColor(grade);
  const remaining = 100 - grade;
  const savingsRate = (netCashFlow / totalIncome) * 100;

  const feedbackText = `
    Financial Health Score: ${grade.toFixed(1)}/100<br><br>
    ${grade >= 80 ? "🌟 Excellent!" : grade >= 60 ? "👍 Good!" : "⚠️ Needs Improvement"}<br><br>
    <b>Detailed Breakdown:</b><br>
    • Savings Rate: ${savingsRate.toFixed(1)}% (Target: >20%)<br>
    • Monthly Surplus: $${netCashFlow.toFixed(0)}<br>
    • Debt-to-Income: ${(
      (Math.abs(sarahData.debt_payments) / totalIncome) *
      100
    ).toFixed(1)}% (Target: <20%)<br>
    • Income Sources: Multiple streams ✓
  `;

  return (
    <Plot
      data={[
        {
          type: "pie",
          labels: ["Financial Health Score", "Room for Growth"],
          values: [grade, remaining],
          hole: 0.6,
          marker: { colors: [gradeColor, "#2C3E50"] },
          textinfo: "none",
          hovertemplate: `<b>%{label}</b><br>Percentage: %{value:.1f}%<br><br>${feedbackText}<extra></extra>`,
          showlegend: false,
        },
      ]}
      layout={{
        title: {
          text: "🎯 Financial Growth Grade<br><sub>Interactive assessment</sub>",
          font: { size: 20, family: "Times New Roman", color: "#2C3E50" },
          x: 0.5,
        },
        height: 500,
        width: 500,
        paper_bgcolor: "#F8F9FA",
        annotations: [
          {
            text: `<b>${grade.toFixed(1)}%</b><br><span style='font-size:14px; color:#7F8C8D'>Grade</span>`,
            x: 0.5,
            y: 0.5,
            showarrow: false,
            font: { size: 36, color: gradeColor },
          },
          {
            text: `<b>Performance Level:</b> ${
              grade >= 80 ? "Excellent" : grade >= 60 ? "Good" : "Needs Improvement"
            }`,
            x: 0.8,
            y: -0.1,
            showarrow: false,
            font: { size: 14, color: gradeColor },
          },
        ],
        margin: { t: 100, b: 80, l: 50, r: 50 },
      }}
      config={{ responsive: true }}
    />
  );
};

export default FinancialGradeChart;
