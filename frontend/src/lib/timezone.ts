export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dateTimeFormatter = (timeZone: string) => {
  if (!isValidIanaTimeZone(timeZone)) {
    throw new Error(`Invalid IANA time zone: ${timeZone}`);
  }
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const isValidIanaTimeZone = (timeZone: string): boolean => {
  if (timeZone !== 'UTC' && !/^[A-Za-z][A-Za-z0-9._+-]*\/[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/.test(timeZone)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
};

const numericPart = (
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number => {
  const value = parts.find(part => part.type === type)?.value;
  if (!value) throw new Error(`Missing ${type} from time-zone formatter.`);
  return Number(value);
};

export const getZonedDateParts = (date: Date, timeZone: string): ZonedDateParts => {
  const parts = dateTimeFormatter(timeZone).formatToParts(date);
  return {
    year: numericPart(parts, 'year'),
    month: numericPart(parts, 'month'),
    day: numericPart(parts, 'day'),
    hour: numericPart(parts, 'hour'),
    minute: numericPart(parts, 'minute'),
    second: numericPart(parts, 'second'),
  };
};

export const formatTimeInTimeZone = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

export const formatDateTimeInTimeZone = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);

export const getPreferredTimeZone = (
  userTimeZone: string | null | undefined,
  campusTimeZone: string | null | undefined,
  schoolTimeZone: string | null | undefined,
): string => {
  for (const timeZone of [userTimeZone, campusTimeZone, schoolTimeZone, 'UTC']) {
    if (timeZone && isValidIanaTimeZone(timeZone)) return timeZone;
  }
  return 'UTC';
};

const localDateTimeToInstant = (
  parts: ZonedDateParts,
  timeZone: string,
): Date | null => {
  const desiredTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let candidateTimestamp = desiredTimestamp;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const actual = getZonedDateParts(new Date(candidateTimestamp), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const difference = desiredTimestamp - actualAsUtc;
    if (difference === 0) return new Date(candidateTimestamp);
    candidateTimestamp += difference;
  }

  return null;
};

export const getNextScheduleOccurrence = (
  startTime: string,
  daysOfWeek: number[],
  timeZone: string,
  now: Date,
): Date | null => {
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(startTime);
  if (!timeMatch) throw new Error(`Invalid scheduled time: ${startTime}`);
  const [, hourText, minuteText, secondText = '0'] = timeMatch;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid scheduled time: ${startTime}`);
  }

  const localNow = getZonedDateParts(now, timeZone);
  const todayUtc = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
  const localWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(now);
  const weekdayNumbers: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const today = weekdayNumbers[localWeekday];
  if (!today) throw new Error(`Unable to determine weekday in ${timeZone}.`);

  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(todayUtc);
    date.setUTCDate(date.getUTCDate() + offset);
    const weekday = date.getUTCDay() || 7;
    if (!daysOfWeek.includes(weekday)) continue;

    const occurrence = localDateTimeToInstant({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour,
      minute,
      second,
    }, timeZone);

    if (occurrence && occurrence.getTime() > now.getTime()) return occurrence;
  }

  return null;
};

export const formatCountdown = (target: Date | null, now: Date): string => {
  if (!target) return '00:00:00';
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
};
