import { useState } from "react";
import { Form, Input, Button, message } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { CheckCircleFilled, LockOutlined, MailOutlined } from "@ant-design/icons";
import { supabase } from "./supabaseClient";
import { AnimatedNumber, Sparkline, money } from "../design";
import { sampleProfile } from "../dashboard/sampleProfile";
import AuthLayout from "./AuthLayout";

function LoginAside() {
  const h = sampleProfile.history;
  return (
    <>
      <div>
        <h2 className="au-side__title">Welcome back.</h2>
        <p className="au-side__lede">Your plan picks up right where you left off.</p>
      </div>
      <div className="au-glass ps-enter" style={{ "--i": 2 }}>
        <p className="au-glass__label">Net worth · sample</p>
        <p className="au-glass__value">
          <AnimatedNumber value={h.netWorth[h.netWorth.length - 1]} format={money} duration={1400} />
        </p>
        <div style={{ margin: "8px -4px 0" }}>
          <Sparkline values={h.netWorth} color="var(--ps-brand-300)" height={56} />
        </div>
        <ul className="au-tasks">
          {["Capture your full 401(k) match", "Pay off your credit card first", "Finish your emergency fund"].map((t, i) => (
            <li key={t} className="ps-enter" style={{ "--i": 4 + i }}>
              <CheckCircleFilled /> {t}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function Login(){
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return message.error(error.message);
      message.success("Welcome back!");
      nav("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout aside={<LoginAside />}>
      <div className="au-head">
        <h1 className="ps-h1">Welcome back</h1>
        <p className="ps-body">So good to see you again. Your plan is right where you left it.</p>
      </div>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
        <Form.Item name="email" label="Email" rules={[{ required:true, type:"email" }]}>
          <Input prefix={<MailOutlined />} placeholder="you@example.com" autoComplete="email" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required:true }]}>
          <Input.Password prefix={<LockOutlined />} placeholder="Your password" autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading} style={{ marginTop: 8 }}>
          Log in
        </Button>
      </Form>
      <p className="au-switch">
        New to Prosperity? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
