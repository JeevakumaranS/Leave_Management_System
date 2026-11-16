/**
 * Strict DD/MM/YYYY Date & DateTime Formatting Utilities
 * Standardized across the entire Durozen Leave Management System
 */

export function formatDate(val: string | Date | null | undefined): string {
  if (!val) return '-';

  // If pure date string like "2026-11-20" or "2026-11-20T00:00:00..."
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const datePart = val.slice(0, 10);
    const [year, month, day] = datePart.split('-');
    // If it contains specific non-zero time component, convert using local time
    if (val.includes('T') && !val.includes('T00:00:00')) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      }
    }
    return `${day}/${month}/${year}`;
  }

  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(val: string | Date | null | undefined, includeSeconds = true): string {
  if (!val) return '-';
  const d = typeof val === 'string' ? new Date(val) : val;
  if (isNaN(d.getTime())) return '-';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
  }
  return `${day}/${month}/${year}, ${hours}:${minutes}`;
}
