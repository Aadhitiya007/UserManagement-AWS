export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendPositive = true,
  comparisonText,
  iconBg = "var(--color-primary-light)",
  iconColor = "var(--color-primary)"
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div
            className="stat-card-icon"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <div className="stat-card-value">{value}</div>

      {(trend || comparisonText) && (
        <div className="stat-card-trend">
          {trend && (
            <span
              style={{
                color: trendPositive ? "var(--color-success)" : "var(--color-error)",
                display: "inline-flex",
                alignItems: "center",
                gap: "2px"
              }}
            >
              {trendPositive ? "↑" : "↓"} {trend}
            </span>
          )}
          {comparisonText && (
            <span style={{ color: "var(--color-text-muted)" }}>
              {comparisonText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

