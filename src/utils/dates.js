// Timestamps from the DB are already in Argentina time (no UTC offset).
// We format the raw parts directly to avoid browser-timezone distortion.
export const formatTimestamp = (isoString) => {
  const [datePart, timePart] = isoString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.replace('Z', '').split(':').map(Number);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const pad = n => String(n).padStart(2, '0');

  return `${monthNames[month - 1]} ${day}, ${year}, ${hour12}:${pad(minute)}:${pad(second)} ${period}`;
};
