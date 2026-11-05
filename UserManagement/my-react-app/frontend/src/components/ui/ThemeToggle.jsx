import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`theme-toggle-btn ${className}`}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle Theme"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "38px",
        height: "38px",
        borderRadius: "var(--radius-sm)",
        color: "var(--color-text-secondary)",
        backgroundColor: "var(--color-surface-subtle)",
        border: "1px solid var(--color-border)",
        transition: "all var(--transition-fast)"
      }}
    >
      {isDark ? (
        <Sun size={18} style={{ color: "#FBBF24" }} />
      ) : (
        <Moon size={18} style={{ color: "var(--color-navy)" }} />
      )}
    </button>
  );
}

