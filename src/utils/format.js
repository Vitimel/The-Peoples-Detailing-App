export const cents = (centsValue) => '$' + (centsValue / 100).toFixed(2);

export const isoToDay = (iso) => {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

export const isoToTime = (iso) => {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
