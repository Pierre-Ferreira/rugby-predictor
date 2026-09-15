export const ADMIN_FIXTURE_TIME_ZONE = 'Africa/Johannesburg';
export const ADMIN_FIXTURE_TIME_ZONE_LABEL =
  'South African time (Africa/Johannesburg)';

const JOHANNESBURG_UTC_OFFSET_MINUTES = 120;
const LOCAL_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const twoDigits = (value: number): string => value.toString().padStart(2, '0');

const fourDigits = (value: number): string => value.toString().padStart(4, '0');

export const isValidDate = (value: Date): boolean =>
  Number.isFinite(value.getTime());

export const parseJohannesburgDateTimeInputToUtcInstant = (
  value: string,
): Date | null => {
  const match = LOCAL_INPUT_PATTERN.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));

  if (
    localAsUtc.getUTCFullYear() !== year ||
    localAsUtc.getUTCMonth() !== month - 1 ||
    localAsUtc.getUTCDate() !== day ||
    localAsUtc.getUTCHours() !== hour ||
    localAsUtc.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return new Date(
    localAsUtc.getTime() - JOHANNESBURG_UTC_OFFSET_MINUTES * 60 * 1000,
  );
};

export const formatUtcInstantForJohannesburgInput = (value: Date): string => {
  const local = new Date(
    value.getTime() + JOHANNESBURG_UTC_OFFSET_MINUTES * 60 * 1000,
  );

  return [
    fourDigits(local.getUTCFullYear()),
    twoDigits(local.getUTCMonth() + 1),
    twoDigits(local.getUTCDate()),
  ]
    .join('-')
    .concat('T')
    .concat(
      [twoDigits(local.getUTCHours()), twoDigits(local.getUTCMinutes())].join(
        ':',
      ),
    );
};

const displayFormatter = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: 'short',
  timeZone: ADMIN_FIXTURE_TIME_ZONE,
  year: 'numeric',
});

export const formatUtcInstantForJohannesburgDisplay = (
  value: Date | string,
): string => {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (!isValidDate(date)) {
    return 'Invalid kickoff time';
  }

  return `${displayFormatter.format(date)} SAST`;
};
