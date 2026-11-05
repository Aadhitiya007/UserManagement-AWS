import { PackageOpen } from "lucide-react";

export default function EmptyState({
  icon: Icon = PackageOpen,
  title = "No data found",
  description = "There are no items to display at this moment.",
  action
}) {
  return (
    <div
      style={{
        padding: "60px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-surface)",
        border: "1px dashed var(--color-border)",
        borderRadius: "var(--radius-lg)",
        margin: "20px 0"
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "var(--color-surface-subtle)",
          color: "var(--color-text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px"
        }}
      >
        <Icon size={28} />
      </div>

      <h3
        style={{
          fontSize: "1.15rem",
          fontWeight: "700",
          color: "var(--color-text-primary)",
          marginBottom: "8px"
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--color-text-secondary)",
          maxWidth: "420px",
          marginBottom: action ? "20px" : "0"
        }}
      >
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}

