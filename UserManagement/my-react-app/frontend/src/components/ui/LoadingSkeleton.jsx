export function CardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}
    >
      <div className="skeleton" style={{ height: "180px", width: "100%" }} />
      <div className="skeleton" style={{ height: "18px", width: "70%" }} />
      <div className="skeleton" style={{ height: "14px", width: "40%" }} />
      <div className="skeleton" style={{ height: "36px", width: "100%", marginTop: "8px" }} />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="skeleton" style={{ height: "16px", width: i === 0 ? "80%" : "60%" }} />
        </td>
      ))}
    </tr>
  );
}

export function StatSkeleton() {
  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        padding: "22px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}
    >
      <div className="skeleton" style={{ height: "14px", width: "45%" }} />
      <div className="skeleton" style={{ height: "32px", width: "65%" }} />
      <div className="skeleton" style={{ height: "12px", width: "35%" }} />
    </div>
  );
}

export default function LoadingSkeleton({ lines = 4, height = "18px" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height,
            width: i === 0 ? "100%" : i === lines - 1 ? "60%" : "85%",
            borderRadius: "6px"
          }}
        />
      ))}
    </div>
  );
}
