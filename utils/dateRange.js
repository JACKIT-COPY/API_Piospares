// utils/dateRange.js
const getMonday = (d) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getStartOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const getStartOfQuarter = (d) => new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
const getStartOfHalf = (d) => new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
const getStartOfYear = (d) => new Date(d.getFullYear(), 0, 1);

module.exports = function getDateRange(period, date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  let start, end;

  switch (period) {
    case 'daily':
      start = new Date(d);
      end = new Date(d); end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      start = getMonday(d);
      end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start = getStartOfMonth(d);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'quarterly':
      start = getStartOfQuarter(d);
      end = new Date(start.getFullYear(), start.getMonth() + 3, 0, 23, 59, 59, 999);
      break;
    case 'half-yearly':
      start = getStartOfHalf(d);
      end = new Date(start.getFullYear(), start.getMonth() + 6, 0, 23, 59, 59, 999);
      break;
    case 'yearly':
      start = getStartOfYear(d);
      end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    default:
      throw new Error('Invalid period');
  }

  return { start, end };
};