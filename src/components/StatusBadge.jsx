const arabicLabels = {
  Processing: 'قيد المعالجة',
  Reviewed: 'تمت المراجعة',
  'Needs review': 'تحتاج إلى مراجعة',
  Everyone: 'الجميع',
  Supervisors: 'المشرفون',
};

export default function StatusBadge({ children, language = 'en' }) {
  const value = String(children || '').toLowerCase().replace(/\s+/g, '-');
  const label = language === 'ar' ? arabicLabels[children] || children : children;
  return <span className={`status-badge status-${value}`}>{label}</span>;
}
