export default function StatusBadge({ children }) {
  const value = String(children || '').toLowerCase().replace(/\s+/g, '-');
  return <span className={`status-badge status-${value}`}>{children}</span>;
}
