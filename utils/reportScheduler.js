/**
 * Report Scheduler Utility
 * Handles calculating next send dates and determining if a report should be sent
 */

/**
 * Calculate next send date based on schedule
 * @param {object} schedule - ReportSchedule document
 * @returns {Date} Next send date
 */
const calculateNextSendDate = (schedule) => {
  const now = new Date();
  const [hours, minutes] = schedule.sendTime.split(':').map(Number);

  let nextDate = new Date();
  nextDate.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, move to next schedule
  if (nextDate <= now) {
    if (schedule.frequency === 'daily') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (schedule.frequency === 'weekly') {
      const daysUntilNextSchedule = getDaysUntilDayOfWeek(schedule.dayOfWeek);
      nextDate.setDate(nextDate.getDate() + (daysUntilNextSchedule || 7));
    } else if (schedule.frequency === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(schedule.dayOfMonth);
    }
  } else if (schedule.frequency === 'weekly') {
    // Check if we're on the right day of week
    if (nextDate.getDay() !== schedule.dayOfWeek) {
      const daysUntilNextSchedule = getDaysUntilDayOfWeek(schedule.dayOfWeek);
      nextDate.setDate(nextDate.getDate() + daysUntilNextSchedule);
      nextDate.setHours(hours, minutes, 0, 0);
    }
  } else if (schedule.frequency === 'monthly') {
    // Check if we're on the right day of month
    if (nextDate.getDate() !== schedule.dayOfMonth) {
      nextDate.setDate(schedule.dayOfMonth);
      nextDate.setHours(hours, minutes, 0, 0);
      
      // If this date has passed in current month, go to next month
      if (nextDate <= now) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    }
  }

  return nextDate;
};

/**
 * Get number of days until a specific day of week
 * @param {number} targetDayOfWeek - 0-6 (0=Sunday)
 * @returns {number} Days until that day (0 if today, 1-6 otherwise)
 */
const getDaysUntilDayOfWeek = (targetDayOfWeek) => {
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  
  let daysUntil = targetDayOfWeek - currentDayOfWeek;
  
  if (daysUntil < 0) {
    daysUntil += 7;
  } else if (daysUntil === 0) {
    daysUntil = 0; // Same day, but time check happens elsewhere
  }
  
  return daysUntil;
};

/**
 * Check if a schedule should send now (within a 5-minute window)
 * @param {object} schedule - ReportSchedule document
 * @returns {boolean}
 */
const shouldSendNow = (schedule) => {
  if (!schedule.isEnabled) return false;
  if (!schedule.nextSendDate) return false;

  const now = new Date();
  const nextSend = new Date(schedule.nextSendDate);
  
  // Check if we're within 5 minutes before or after the scheduled time
  const minutesBefore = new Date(nextSend.getTime() - 5 * 60 * 1000);
  const minutesAfter = new Date(nextSend.getTime() + 5 * 60 * 1000);
  
  return now >= minutesBefore && now <= minutesAfter;
};

/**
 * Format countdown display
 * @param {Date} nextSendDate - Next send date
 * @returns {object} Formatted countdown info
 */
const getCountdownDisplay = (nextSendDate) => {
  if (!nextSendDate) {
    return {
      displayText: 'Not scheduled',
      daysLeft: 0,
      hoursLeft: 0,
      minutesLeft: 0,
      secondsLeft: 0
    };
  }

  const now = new Date();
  const diff = new Date(nextSendDate).getTime() - now.getTime();
  
  if (diff < 0) {
    return {
      displayText: 'Sending...',
      daysLeft: 0,
      hoursLeft: 0,
      minutesLeft: 0,
      secondsLeft: 0
    };
  }

  const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);

  let displayText = '';
  if (daysLeft > 0) displayText = `${daysLeft}d ${hoursLeft}h`;
  else if (hoursLeft > 0) displayText = `${hoursLeft}h ${minutesLeft}m`;
  else displayText = `${minutesLeft}m ${secondsLeft}s`;

  return {
    displayText,
    daysLeft,
    hoursLeft,
    minutesLeft,
    secondsLeft
  };
};

/**
 * Get frequency display label
 */
const getFrequencyLabel = (frequency, dayOfWeek = null, dayOfMonth = null) => {
  if (frequency === 'daily') {
    return 'Daily';
  } else if (frequency === 'weekly') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Weekly on ${days[dayOfWeek || 1]}`;
  } else if (frequency === 'monthly') {
    const suffix = (day) => {
      if (day === 1) return 'st';
      if (day === 2) return 'nd';
      if (day === 3) return 'rd';
      return 'th';
    };
    return `Monthly on the ${dayOfMonth || 1}${suffix(dayOfMonth || 1)}`;
  }
  return frequency;
};

module.exports = {
  calculateNextSendDate,
  getDaysUntilDayOfWeek,
  shouldSendNow,
  getCountdownDisplay,
  getFrequencyLabel
};
