import { createElement } from "react";
import { ConfigProvider } from "antd";

// Ant Design tokens matching tokens.css, for screens that use antd form controls.
export const antdTheme = {
  token: {
    colorPrimary: "#2f6b48",
    colorInfo: "#2f6b48",
    colorSuccess: "#1d7446",
    colorWarning: "#8f5f00",
    colorError: "#ad5540",
    colorText: "#101a14",
    colorTextSecondary: "#46544b",
    colorTextPlaceholder: "#5f6b63",
    colorBorder: "#cdd5cc",
    colorBgContainer: "#ffffff",
    fontFamily: '"Jost", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 15,
    borderRadius: 14,
    controlHeight: 40,
    controlHeightLG: 46,
    controlOutline: "rgba(61, 138, 90, 0.28)",
    controlOutlineWidth: 3,
  },
  components: {
    Form: { labelColor: "#101a14", labelFontSize: 13, verticalLabelPadding: "0 0 6px", itemMarginBottom: 20 },
    Button: { fontWeight: 500, borderRadius: 999, borderRadiusLG: 999, primaryShadow: "0 6px 14px -6px rgba(47, 107, 72, 0.55)" },
    Message: { contentPadding: "10px 16px" },
  },
};

// Toasts from antd's static `message` render outside the React tree, so theme them here too.
ConfigProvider.config({
  holderRender: (children) => createElement(ConfigProvider, { theme: antdTheme }, children),
});
