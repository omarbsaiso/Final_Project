export function formatDateTime(value, language = 'en') {
  if (!value) return '—';
  const date = new Date(typeof value?.toDate === 'function' ? value.toDate() : value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = language === 'ar' ? 'ar' : 'en-US';
  return date.toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(value, language = 'en') {
  if (!Number.isFinite(value)) return value || '—';
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const units = language === 'ar' ? { hours: 'س', minutes: 'د', seconds: 'ث' } : { hours: 'h', minutes: 'm', seconds: 's' };
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}${units.hours} ${minutes % 60}${units.minutes}`
    : `${minutes}${units.minutes} ${String(seconds).padStart(2, '0')}${units.seconds}`;
}

export function formatFileSize(value) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  return value >= 1024 * 1024
    ? `${(value / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(value / 1024))} KB`;
}
