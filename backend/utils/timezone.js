/**
 * Timezone utility functions for handling lockout times
 */

/**
 * Convert a datetime-local string (from frontend) to UTC timestamp
 * @param {string} datetimeLocal - String in "YYYY-MM-DDTHH:MM" format
 * @returns {string|null} - UTC timestamp string or null if invalid
 */
function datetimeLocalToUTC(datetimeLocal) {
  if (!datetimeLocal || typeof datetimeLocal !== 'string') {
    return null;
  }

  try {
    // Create a Date object from the datetime-local input
    // This will be interpreted in the user's local timezone
    const localDate = new Date(datetimeLocal);
    
    if (isNaN(localDate.getTime())) {
      return null;
    }

    // Convert to UTC by adjusting for timezone offset
    const localOffset = localDate.getTimezoneOffset() * 60000; // Convert minutes to milliseconds
    const utcDate = new Date(localDate.getTime() + localOffset);
    
    return utcDate.toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    console.error('Error converting datetime-local to UTC:', error);
    return null;
  }
}

/**
 * Convert a UTC timestamp to a local datetime string for display
 * @param {string} utcTimestamp - UTC timestamp string
 * @param {number} timezoneOffset - User's timezone offset in minutes
 * @returns {string|null} - Local datetime string or null if invalid
 */
function utcToLocalDatetime(utcTimestamp, timezoneOffset = 0) {
  if (!utcTimestamp) {
    return null;
  }

  try {
    const utcDate = new Date(utcTimestamp);
    
    if (isNaN(utcDate.getTime())) {
      return null;
    }

    // Convert UTC to local time by subtracting timezone offset
    const localDate = new Date(utcDate.getTime() - (timezoneOffset * 60000));
    
    return localDate.toISOString();
  } catch (error) {
    console.error('Error converting UTC to local datetime:', error);
    return null;
  }
}

/**
 * Get current server time in UTC
 * @returns {string} - Current UTC timestamp string
 */
function getCurrentUTCTime() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Get current server time in local timezone
 * @param {number} timezoneOffset - User's timezone offset in minutes
 * @returns {string} - Current local timestamp string
 */
function getCurrentLocalTime(timezoneOffset = 0) {
  const now = new Date();
  const localTime = new Date(now.getTime() - (timezoneOffset * 60000));
  return localTime.toISOString();
}

module.exports = {
  datetimeLocalToUTC,
  utcToLocalDatetime,
  getCurrentUTCTime,
  getCurrentLocalTime
};
