export default function PageHeader({
  title,
  subtitle,
  badge,
  actions
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: "28px"
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <h1
            style={{
              fontSize: "1.85rem",
              fontWeight: "800",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.03em",
              margin: 0
            }}
          >
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--color-text-secondary)",
              margin: 0
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {actions}
        </div>
      )}
    </div>
  );
}

