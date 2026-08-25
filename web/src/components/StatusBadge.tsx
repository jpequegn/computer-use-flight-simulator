interface StatusBadgeProps {
  tone: "neutral" | "safe" | "warning" | "danger";
  children: string;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`status-badge status-${tone}`}>{children.replaceAll("_", " ")}</span>;
}
