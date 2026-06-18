// AES-01: Shared price formatter used across all pages
export function formatPrice(n, opts = {}) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const num = parseFloat(n);
  if (num >= 1000)   return num.toLocaleString('en', { maximumFractionDigits: 0 });
  if (num >= 1)      return num.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 0.01)   return num.toFixed(4);
  return num.toFixed(6);
}

export function formatChange(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const num = parseFloat(n);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}
