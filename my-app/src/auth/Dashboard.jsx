import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Typography, Spin, Alert, Button } from "antd";
import { supabase } from "./supabaseClient";
import FinancialGradeChart from "./FinancialGradeChart";
import CashFlowBarChart from "./CashFlowBarChart";
import SavingsProjectChart from "./SavingsProjectChart";

const { Title, Text } = Typography;

/**
 * Build the data shape expected by FinancialGradeChart / CashFlowBarChart from DB rows.
 * Income: annual_income. Spending: rent_utilities (monthly), groceries_food (weekly), debt_payment (monthly), others (weekly).
 */
function buildChartDataFromUser(incomeRow, savingsRow, spendingRow) {
  const monthlyIncome = (incomeRow?.annual_income ?? 0) / 12;
  const rent = -(spendingRow?.rent_utilities ?? 0);
  const groceries = -((spendingRow?.groceries_food ?? 0) * 4.33);
  const debt_payments = -(spendingRow?.debt_payment ?? 0);
  const others = -((spendingRow?.others ?? 0) * 4.33);

  return {
    salary: monthlyIncome,
    freelance: 0,
    dividends: 0,
    rent,
    utilities: 0,
    insurance: 0,
    debt_payments,
    phone: 0,
    gym: 0,
    subscriptions: 0,
    groceries,
    dining_out: 0,
    gas_transport: 0,
    // single "other" for anything else
    others,
  };
}

function computeNetCashFlow(chartData) {
  const income =
    chartData.salary + chartData.freelance + chartData.dividends;
  const expenses =
    chartData.rent +
    chartData.utilities +
    chartData.insurance +
    chartData.debt_payments +
    chartData.groceries +
    chartData.dining_out +
    chartData.gas_transport +
    chartData.phone +
    chartData.gym +
    chartData.subscriptions +
    chartData.others;
  return income + expenses; // expenses are negative
}

export default function Dashboard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [incomeRow, setIncomeRow] = useState(null);
  const [savingsRow, setSavingsRow] = useState(null);
  const [spendingRow, setSpendingRow] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authUser?.id) {
          nav("/login", { replace: true });
          return;
        }

        const { data: userRow, error: userErr } = await supabase
          .from("Users")
          .select("id, name, email, financial_goals")
          .eq("auth_uid", authUser.id)
          .maybeSingle();

        if (userErr) throw userErr;
        if (!userRow && !cancelled) {
          setError("No profile found. Complete signup to see your dashboard.");
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setUserProfile(userRow);

        const userId = userRow?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        // Fetch this user's data only — each user has a unique id, so we get their latest row.
        const [incRes, savRes, spendRes] = await Promise.all([
          supabase.from("Income").select("*").eq("user_id", userId).order("id", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("Savings").select("*").eq("user_id", userId).order("id", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("Spending").select("*").eq("user_id", userId).order("id", { ascending: false }).limit(1).maybeSingle(),
        ]);

        if (cancelled) return;
        if (incRes.error) throw incRes.error;
        if (savRes.error) throw savRes.error;
        if (spendRes.error) throw spendRes.error;
        setIncomeRow(incRes.data ?? null);
        setSavingsRow(savRes.data ?? null);
        setSpendingRow(spendRes.data ?? null);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load dashboard");
          console.error("Dashboard load error:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading your dashboard…</Text>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: "48px auto", padding: 24 }}>
        <Alert
          type="error"
          showIcon
          message="Could not load dashboard"
          description={error}
        />
        <Button type="primary" onClick={() => nav("/login")} style={{ marginTop: 16 }}>
          Go to login
        </Button>
      </div>
    );
  }

  const chartData = buildChartDataFromUser(incomeRow, savingsRow, spendingRow);
  const netCashFlow = computeNetCashFlow(chartData);
  const displayName = userProfile?.name || userProfile?.email || "Your";

  return (
    <div style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 0,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          {displayName}'s Dashboard
        </Title>
        <Button onClick={handleLogout}>Log out</Button>
      </div>
      <div style={{ display: "grid", gap: 24, marginTop: 24 }}>
        <Card title="Financial grade" style={{ borderRadius: 12 }}>
          <FinancialGradeChart userData={chartData} userName={displayName} />
        </Card>
        <Card title="Monthly cash flow" style={{ borderRadius: 12 }}>
          <CashFlowBarChart userData={chartData} userName={displayName} />
        </Card>
        <Card title="Savings projection" style={{ borderRadius: 12 }}>
          <SavingsProjectChart
            netCashFlow={netCashFlow}
            houseGoal={50000}
            currentSavings={savingsRow?.current_amount ?? 0}
          />
        </Card>
      </div>
    </div>
  );
}
