// Sample profile used until the dashboard reads the user's survey answers from Supabase.
// Every number on the dashboard is derived from this object, so swapping it for real
// data is the only change needed. All amounts are monthly unless named otherwise.

export const sampleProfile = {
  name: "Angelina Ponce",
  age: 26,
  retirementAge: 60,
  literacy: "intermediate",
  riskTolerance: "growth",

  income: [
    { name: "Salary (take-home)", monthly: 5900 },
    { name: "Freelance", monthly: 350 },
  ],

  // `slot` fixes each category's chart color, so filtering never repaints them.
  expenses: [
    { key: "housing", name: "Housing & utilities", short: "Housing", monthly: 1600, essential: true, slot: 1 },
    { key: "food", name: "Groceries & dining", short: "Food", monthly: 680, essential: true, discretionary: 0.35, slot: 2 },
    { key: "transport", name: "Transportation", short: "Transport", monthly: 260, essential: true, slot: 3 },
    { key: "insurance", name: "Insurance", short: "Insurance", monthly: 420, essential: true, slot: 4 },
    { key: "bills", name: "Phone & subscriptions", short: "Bills", monthly: 140, discretionary: 0.5, slot: 5 },
    { key: "fun", name: "Entertainment & shopping", short: "Fun", monthly: 350, discretionary: 1, slot: 6 },
  ],

  debts: [
    { name: "Credit card", balance: 3200, apr: 0.229, minPayment: 95 },
    { name: "Car loan", balance: 8400, apr: 0.069, minPayment: 260 },
    { name: "Student loan", balance: 14400, apr: 0.055, minPayment: 245 },
  ],

  accounts: [
    { name: "Checking", kind: "cash", balance: 2500 },
    { name: "High-yield savings", kind: "cash", balance: 12000, apy: 0.043, emergency: true },
    { name: "House fund", kind: "cash", balance: 4500 },
    { name: "401(k)", kind: "invest", balance: 9800 },
  ],

  otherAssets: [{ name: "Car", value: 15000 }],

  retirement: { salaryAnnual: 78000, contributionRate: 0.03, matchUpTo: 0.05 },

  // How the monthly surplus is split today.
  allocation: [
    { key: "emergency", name: "Emergency fund", monthly: 900, slot: 1 },
    { key: "house", name: "House fund", monthly: 600, slot: 2 },
    { key: "debt", name: "Extra debt payments", monthly: 300, slot: 3 },
    { key: "invest", name: "Investing", monthly: 400, slot: 4 },
  ],

  goals: [
    { key: "emergency", name: "Emergency fund", icon: "safety", target: null, account: "High-yield savings", allocation: "emergency" },
    { key: "house", name: "House down payment", icon: "home", target: 60000, targetDate: "2031-06", account: "House fund", allocation: "house" },
  ],

  // Last 12 month-end snapshots, oldest first.
  history: {
    months: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    netWorth: [-1700, -100, 1400, 3300, 4900, 6800, 8400, 10100, 11900, 13600, 15700, 17800],
    income: [5900, 6100, 5900, 5950, 6000, 6050, 6100, 6000, 6150, 6200, 6050, 6250],
    spending: [3900, 4300, 3700, 3600, 3650, 3500, 3600, 3550, 3500, 3480, 3520, 3450],
    emergencyMonths: [1.1, 1.3, 1.5, 1.7, 1.9, 2.1, 2.4, 2.6, 2.8, 3.0, 3.2, 3.37],
  },
};
