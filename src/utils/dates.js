export const formatTimestamp = (isoString) => {
  const [datePart, timePartWithZ] = isoString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);

  const timePart = timePartWithZ.replace('Z', '');
  const [hour, minute, second] = timePart.split(':').map((val) => parseInt(val, 10));

  // Create the date as if it's already in Argentina time (ignore UTC interpretation)
  const localDate = new Date(year, month - 1, day, hour, minute, second);

  return localDate.toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};
