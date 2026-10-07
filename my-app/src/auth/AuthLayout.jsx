import { ConfigProvider } from "antd";
import { Link } from "react-router-dom";
import { LogoMark, antdTheme } from "../design";
import "./auth.css";

// Split screen used by Login and SignUp: a brand panel beside the form.
export default function AuthLayout({ aside, children, wide }) {
  return (
    <ConfigProvider theme={antdTheme}>
      <div className="ps-root au">
        <aside className="au-side">
          <Link to="/" className="au-logo">
            <LogoMark />
            Prosperity
          </Link>
          <div className="au-side__body">{aside}</div>
          <p className="au-side__foot">© 2025 Prosperity · Built at HackMIT</p>
        </aside>
        <main className="au-main">
          <Link to="/" className="au-logo au-logo--mobile">
            <LogoMark />
            Prosperity
          </Link>
          <div className={`au-panel${wide ? " au-panel--wide" : ""}`}>{children}</div>
        </main>
      </div>
    </ConfigProvider>
  );
}
