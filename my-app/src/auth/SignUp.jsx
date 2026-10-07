// src/auth/SignUp.jsx
import { useEffect, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Alert,
} from "antd";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeftOutlined, CheckOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { supabase } from "./supabaseClient";
import { AnimatedNumber, money } from "../design";
import AuthLayout from "./AuthLayout";

// Shared props for dollar inputs: thousands separators while typing, plain numbers in the form value.
const moneyProps = {
  prefix: "$",
  style: { width: "100%" },
  min: 0,
  formatter: (v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ","),
  parser: (v) => v?.replace(/,/g, ""),
};
const WEEKS_PER_MONTH = 52 / 12;

// Wraps a step's submit so its button shows a spinner while saving.
function useSaving(submit) {
  const [saving, setSaving] = useState(false);
  const run = async (values) => {
    setSaving(true);
    try {
      await submit(values);
    } finally {
      setSaving(false);
    }
  };
  return [saving, run];
}

export default function SignUp() {
  const nav = useNavigate();

  // auth uuid from Supabase
  const [uid, setUid] = useState(null);

  // numeric Users.id (int8) used by Income/Savings/Spending.user_id
  const [userRowId, setUserRowId] = useState(null);

  // UI state
  const [current, setCurrent] = useState(0);
  const [emailCached, setEmailCached] = useState("");

  // fetch logged-in user (if any)
  useEffect(() => {
    (async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) console.warn("getUser error:", error.message);
      if (user?.id) setUid(user.id);
    })();
  }, []);

  const stepsMeta = [
    { title: "Account", heading: "Create your account", description: "You'll use this email and password to log in." },
    { title: "Personal", heading: "About you", description: "A little context helps us tailor advice to where you are in life." },
    { title: "Income", heading: "Your income", description: "Roughly how much you earn in a year, before taxes. We'll do the monthly math for you." },
    { title: "Savings", heading: "Your savings", description: "What you have set aside today. Rough numbers are fine." },
    { title: "Spending", heading: "Spending and debt", description: "Think of a typical month or week. Best guesses are perfect, and you can change these later." },
  ];

  // Answers so far, used only for the live snapshot beside the form.
  const [draft, setDraft] = useState({});
  const onDraft = (values) => setDraft((d) => ({ ...d, ...values }));
  const [direction, setDirection] = useState("forward");

  const next = () => {
    setDirection("forward");
    setCurrent((c) => Math.min(c + 1, stepsMeta.length - 1));
  };
  const prev = () => {
    setDirection("back");
    setCurrent((c) => Math.max(c - 1, 0));
  };

  const steps = [
    {
      key: "account",
      content: (
        <AccountStep
          onDone={(newUid, email) => {
            if (newUid) setUid(newUid);
            if (email) setEmailCached(email);
            console.log("AccountStep → next()");
            next();
          }}
        />
      ),
      showNav: false,
    },
    {
      key: "personal",
      content: (
        <PersonalStep
          uid={uid}
          emailFallback={emailCached}
          setUserRowId={setUserRowId}
          onDraft={onDraft}
          onDone={() => {
            console.log("PersonalStep → next()");
            next();
          }}
        />
      ),
      showNav: true,
    },
    {
      key: "income",
      content: (
        <IncomeStep
          userRowId={userRowId}
          onDraft={onDraft}
          onDone={() => {
            console.log("IncomeStep → next()");
            next();
          }}
        />
      ),
      showNav: true,
    },
    {
      key: "savings",
      content: (
        <SavingsStep
          userRowId={userRowId}
          onDraft={onDraft}
          onDone={() => {
            console.log("SavingsStep → next()");
            next();
          }}
        />
      ),
      showNav: true,
    },
    {
      key: "spending",
      content: (
        <SpendingStep
          userRowId={userRowId}
          onDraft={onDraft}
          onFinish={() => {
            console.log("SpendingStep → nav(/app/individual/first-time)");
            nav("/app/individual/first-time", { replace: true });
          }}
        />
      ),
      showNav: true,
    },
  ];

  const meta = stepsMeta[current];
  const snapshot = summarize(draft);

  return (
    <AuthLayout wide aside={<SignUpAside stepsMeta={stepsMeta} current={current} snapshot={snapshot} name={draft.name} />}>
      <div className="au-progress">
        <div className="au-progress__meta">
          <span>
            Step <strong>{current + 1}</strong> of {stepsMeta.length}
          </span>
          <span>{meta.title}</span>
        </div>
        <div className="au-progress__track">
          <div className="au-progress__fill" style={{ width: `${((current + 1) / stepsMeta.length) * 100}%` }} />
        </div>
      </div>

      {steps[current].showNav && current > 0 && (
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={prev} style={{ marginLeft: -12, marginBottom: 12 }}>
          Back
        </Button>
      )}

      <div key={current} className={`au-step-swap${direction === "back" ? " is-back" : ""}`}>
        <div className="au-head">
          <h1 className="ps-h1">{meta.heading}</h1>
          <p className="ps-body">{meta.description}</p>
        </div>
        {snapshot.income > 0 && current >= 3 && (
          <div className="au-mobile-snapshot">
            <MobileSnapshot snapshot={snapshot} />
          </div>
        )}
        {steps[current].content}
      </div>

      {current === 0 && (
        <p className="au-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      )}
    </AuthLayout>
  );
}

/* ------------------ Live snapshot ------------------ */
function summarize(d) {
  const income = Number(d.annual_income || 0) / 12;
  const spending =
    Number(d.rent_utilities || 0) +
    Number(d.groceries_food || 0) * WEEKS_PER_MONTH +
    Number(d.others || 0) * WEEKS_PER_MONTH +
    Number(d.debt_payment || 0);
  const saved = Number(d.current_amount || 0) + Number(d.checking_account || 0);
  return { income, spending, leftOver: income - spending, saved, debt: Number(d.debt_left || 0) };
}

function SignUpAside({ stepsMeta, current, snapshot, name }) {
  const rows = [
    ["Monthly income", snapshot.income],
    ["Monthly spending", snapshot.spending],
    ["Left over each month", snapshot.leftOver],
    ["Savings and checking", snapshot.saved],
    ["Debt remaining", snapshot.debt],
  ].filter(([, v]) => v);
  return (
    <>
      <div>
        <h2 className="au-side__title">{name ? `Nice to meet you, ${name.split(" ")[0]}.` : "Let's build your plan."}</h2>
        <p className="au-side__lede">Five short steps. Your answers save each time you continue.</p>
      </div>
      <ol className="au-steps">
        {stepsMeta.map((s, i) => (
          <li key={s.title} className={i === current ? "is-current" : i < current ? "is-done" : ""}>
            <span className="au-steps__dot">{i < current ? <CheckOutlined /> : i + 1}</span>
            {s.title}
          </li>
        ))}
      </ol>
      <div className="au-glass">
        <p className="au-glass__label">Your snapshot</p>
        {rows.length ? (
          <div style={{ marginTop: 8 }}>
            {rows.map(([label, value]) => (
              <div className="au-glass__row" key={label}>
                <span>{label}</span>
                <span><AnimatedNumber value={value} format={money} duration={500} /></span>
              </div>
            ))}
          </div>
        ) : (
          <p className="au-glass__empty" style={{ marginTop: 8 }}>Your numbers will add up here as you go.</p>
        )}
      </div>
    </>
  );
}

function MobileSnapshot({ snapshot }) {
  return (
    <div className="ps-card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span className="ps-small">Left over each month so far</span>
      <strong className="ps-num"><AnimatedNumber value={snapshot.leftOver} format={money} duration={500} /></strong>
    </div>
  );
}

/* ------------------ STEP 0: Account / Auth ------------------ */
function AccountStep({ onDone }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const submit = async ({ email, password }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/signup` },
      });

      if (error?.message?.toLowerCase().includes("already registered")) {
        const { data: d2, error: e2 } =
          await supabase.auth.signInWithPassword({ email, password });
        if (e2) {
          message.warning("Looks like you already have an account, but we couldn't sign you in. You can keep going for now.");
          return onDone(null, email);
        }
        message.success("Welcome back!");
        return onDone(d2.user.id, email);
      }

      if (error) {
        message.warning(`${error.message} No worries, you can keep going.`);
        return onDone(null, email);
      }

      // If email confirm ON, user may be null → try reading again
      let id = data.user?.id;
      if (!id) {
        const { data: gu } = await supabase.auth.getUser();
        id = gu?.user?.id ?? null;
      }

      if (!id) {
        message.info("Check your inbox to confirm your email. You can keep going in the meantime.");
        return onDone(null, email);
      }

      message.success("Your account is ready!");
      onDone(id, email);
    } catch (e) {
      console.error("AccountStep error:", e);
      message.error("Something went wrong on our end, but you can keep going.");
      onDone(null, form.getFieldValue("email"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" form={form} onFinish={submit} requiredMark={false} size="large">
      <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
        <Input prefix={<MailOutlined />} placeholder="you@example.com" autoComplete="email" />
      </Form.Item>
      <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]} extra={<PasswordStrength form={form} />}>
        <Input.Password prefix={<LockOutlined />} placeholder="At least 6 characters" autoComplete="new-password" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading} block>
        Continue
      </Button>
    </Form>
  );
}

function PasswordStrength({ form }) {
  const pw = Form.useWatch("password", form) || "";
  const score = [pw.length >= 6, pw.length >= 10, /[A-Z]/.test(pw) && /[a-z]/.test(pw), /[0-9\W]/.test(pw)].filter(Boolean).length;
  const colors = ["var(--ps-negative-fill)", "var(--ps-warning-fill)", "var(--ps-brand-400)", "var(--ps-brand-600)"];
  const labels = ["Too short", "Okay", "Good", "Strong"];
  if (!pw) return null;
  return (
    <div aria-live="polite">
      <div className="au-strength">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ background: i < Math.max(1, score) ? colors[Math.max(0, score - 1)] : undefined }} />
        ))}
      </div>
      <div className="au-strength-label">{labels[Math.max(0, score - 1)]}</div>
    </div>
  );
}

/* ------------------ STEP 1: Users (bridge with auth_uid) ------------------ */
function PersonalStep({ uid, emailFallback, setUserRowId, onDraft, onDone }) {
  const [form] = Form.useForm();

  const submit = async (v) => {
    try {
      if (!uid) {
        message.info("You're not signed in yet, so we'll save your answers once you are.");
        setUserRowId(null);
        return;
      }

      const { error: upErr } = await supabase
        .from("Users")
        .upsert(
          {
            auth_uid: uid, // BRIDGE
            name: v.name,
            age: v.age ?? null,
            email: v.email || emailFallback,
            occupation: v.occupation ?? null,
            financial_goals: v.financial_goals ?? null,
          },
          { onConflict: "auth_uid" } // requires a unique index on auth_uid
        );

      if (upErr) {
        message.error(upErr.message);
        setUserRowId(null);
        return;
      }

      const { data: row, error: selErr } = await supabase
        .from("Users")
        .select("id")
        .eq("auth_uid", uid)
        .maybeSingle();

      if (selErr || !row) {
        message.info("Saved! We'll finish linking your account in a moment.");
        setUserRowId(null);
        return;
      }

      setUserRowId(row.id);
      message.success("Nice to meet you!");
    } catch (e) {
      console.error("PersonalStep error:", e);
      message.error("Something went wrong on our end, but you can keep going.");
      setUserRowId(null);
    } finally {
      onDone(); // ALWAYS advance
    }
  };

  const [saving, run] = useSaving(submit);
  return (
    <>
      {!uid && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="You can keep going without confirming your email. We'll save your answers once you're signed in."
        />
      )}

      <Form layout="vertical" form={form} onFinish={run} requiredMark={false} size="large" onValuesChange={(_, all) => onDraft(all)}>
        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input placeholder="Your name" autoComplete="name" />
        </Form.Item>
        <div className="au-grid-2">
          <Form.Item name="age" label="Age">
            <InputNumber style={{ width: "100%" }} min={0} placeholder="e.g. 26" />
          </Form.Item>
          <Form.Item name="occupation" label="Occupation">
            <Input placeholder="e.g. Student, Engineer" />
          </Form.Item>
        </div>
        <Form.Item
          name="email"
          label="Email"
          initialValue={emailFallback}
          rules={[{ type: "email" }]}
        >
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item name="financial_goals" label="Financial goals" extra="For example: pay off loans, save for a house, start investing.">
          <Input.TextArea rows={3} placeholder="What would you like to achieve?" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} block>
          Continue
        </Button>
      </Form>
    </>
  );
}

/* ------------------ STEP 2: Income ------------------ */
function IncomeStep({ userRowId, onDraft, onDone }) {
  const [form] = Form.useForm();
  const annual = Form.useWatch("annual_income", form);
  const submit = async (v) => {
    try {
      if (!userRowId) {
        message.info("We couldn't save this step just yet, but you can keep going.");
        return;
      }
      const { error } = await supabase.from("Income").insert({
        user_id: userRowId,
        annual_income: Number(v.annual_income || 0),
      });
      if (error) message.error(error.message);
      else message.success("Got it!");
    } catch (e) {
      console.error("IncomeStep error:", e);
      message.error("Something went wrong on our end, but you can keep going.");
    } finally {
      onDone(); // ALWAYS advance
    }
  };
  const [saving, run] = useSaving(submit);
  return (
    <Form layout="vertical" form={form} onFinish={run} requiredMark={false} size="large" onValuesChange={(_, all) => onDraft(all)}>
      <Form.Item
        name="annual_income"
        label="Annual income"
        rules={[{ required: true }]}
        extra={annual ? <span>That's about <strong className="ps-num">{money(Number(annual) / 12)}</strong> a month.</span> : "Include salary and any regular side income."}
      >
        <InputNumber {...moneyProps} placeholder="e.g. 60,000" autoFocus />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving} block>
        Continue
      </Button>
    </Form>
  );
}

/* ------------------ STEP 3: Savings ------------------ */
function SavingsStep({ userRowId, onDraft, onDone }) {
  const [form] = Form.useForm();
  const submit = async (v) => {
    try {
      if (!userRowId) {
        message.info("We couldn't save this step just yet, but you can keep going.");
        return;
      }
      const { error } = await supabase.from("Savings").insert({
        user_id: userRowId,
        saving_investment_account: !!v.saving_investment_account,
        current_amount: Number(v.current_amount || 0),
        interest_rate: Number(v.interest_rate || 0) / 100,
        checking_account: Number(v.checking_account || 0),
      });
      if (error) message.error(error.message);
      else message.success("Saved. Every bit counts!");
    } catch (e) {
      console.error("SavingsStep error:", e);
      message.error("Something went wrong on our end, but you can keep going.");
    } finally {
      onDone(); // ALWAYS advance
    }
  };
  const [saving, run] = useSaving(submit);
  return (
    <Form layout="vertical" form={form} onFinish={run} requiredMark={false} size="large" onValuesChange={(_, all) => onDraft(all)}>
      <div className="au-grid-2">
        <Form.Item name="current_amount" label="Savings balance">
          <InputNumber {...moneyProps} placeholder="0" />
        </Form.Item>
        <Form.Item name="checking_account" label="Checking balance">
          <InputNumber {...moneyProps} placeholder="0" />
        </Form.Item>
      </div>
      <Form.Item name="interest_rate" label="Savings interest rate" extra="Check your bank app. High-yield accounts pay around 4%.">
        <InputNumber style={{ width: "100%" }} min={0} step={0.1} suffix="%" placeholder="e.g. 4.3" />
      </Form.Item>
      <Form.Item
        name="saving_investment_account"
        label="Do you have an investment account?"
        valuePropName="checked"
        extra="A 401(k), IRA or brokerage account."
      >
        <Switch checkedChildren="Yes" unCheckedChildren="No" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving} block>
        Continue
      </Button>
    </Form>
  );
}

/* ------------------ STEP 4: Spending ------------------ */
function SpendingStep({ userRowId, onDraft, onFinish }) {
  const [form] = Form.useForm();
  const submit = async (v) => {
    try {
      if (!userRowId) {
        message.info("We couldn't save this step just yet, but you can keep going.");
      } else {
        const { error } = await supabase.from("Spending").insert({
          user_id: userRowId,
          rent_utilities: Number(v.rent_utilities || 0),
          groceries_food: Number(v.groceries_food || 0),
          debt_payment: Number(v.debt_payment || 0),
          debt_interest: Number(v.debt_interest || 0) / 100,
          debt_left: Number(v.debt_left || 0),
          others: Number(v.others || 0),
          debt: v.debt || null,
        });
        if (error) message.error(error.message);
        else message.success("All saved!");
      }
    } catch (e) {
      console.error("SpendingStep error:", e);
      message.error("Something went wrong on our end, but you can keep going.");
    } finally {
      onFinish(); // ALWAYS advance to landing
    }
  };
  const [saving, run] = useSaving(submit);
  return (
    <Form layout="vertical" form={form} onFinish={run} requiredMark={false} size="large" onValuesChange={(_, all) => onDraft(all)}>
      <p className="ps-eyebrow" style={{ marginBottom: 12 }}>Spending</p>
      <Form.Item name="rent_utilities" label="Rent & utilities (monthly)">
        <InputNumber {...moneyProps} placeholder="0" />
      </Form.Item>
      <div className="au-grid-2">
        <Form.Item name="groceries_food" label="Groceries & food (weekly)">
          <InputNumber {...moneyProps} placeholder="0" />
        </Form.Item>
        <Form.Item name="others" label="Other expenses (weekly)">
          <InputNumber {...moneyProps} placeholder="0" />
        </Form.Item>
      </div>
      <p className="ps-eyebrow" style={{ margin: "8px 0 12px" }}>Debt</p>
      <div className="au-grid-2">
        <Form.Item name="debt_left" label="Debt remaining">
          <InputNumber {...moneyProps} placeholder="0" />
        </Form.Item>
        <Form.Item name="debt_payment" label="Monthly payment">
          <InputNumber {...moneyProps} placeholder="0" />
        </Form.Item>
      </div>
      <Form.Item name="debt_interest" label="Debt interest rate (APR)" extra="The yearly interest rate on your debt. You'll find it on your statement.">
        <InputNumber style={{ width: "100%" }} min={0} step={0.1} suffix="%" placeholder="e.g. 6.5" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={saving} block>
        Finish and see my dashboard
      </Button>
    </Form>
  );
}
