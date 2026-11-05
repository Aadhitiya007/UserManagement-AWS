export default function Badge({
  children,
  variant = "neutral", // success, warning, danger, info, neutral
  icon: Icon,
  className = ""
}) {
  const variantClass = `badge-${variant}`;

  return (
    <span className={`badge ${variantClass} ${className}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

