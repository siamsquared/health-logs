import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Setup plugins
dayjs.extend(buddhistEra);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale('th');

// Standard formats constants
// Using YYYY for full Common Era year (e.g., 2024)
export const DATE_FORMAT = 'D MMM YYYY';      // 25 ธ.ค. 2024
export const TIME_FORMAT = 'HH:mm';           // 14:30
export const DATETIME_FORMAT = 'D MMM YYYY HH:mm';

/**
 * Reusable Date Formatter
 * Handles B.E. year parsing if year > 2400
 */
export const formatDate = (
    date: string | number | Date | null | undefined,
    format: string = DATE_FORMAT
): string => {
    if (!date) return '-';

    let dayjsDate;
    if (typeof date === 'string' && date.includes('/')) {
        // Try parsing DD/MM/YYYY
        dayjsDate = dayjs(date, 'DD/MM/YYYY');
        if (!dayjsDate.isValid()) {
            dayjsDate = dayjs(date);
        }
    } else {
        dayjsDate = dayjs(date);
    }

    // Check if date is valid
    if (!dayjsDate.isValid()) return '-';

    // If year is in Buddhist Era range (e.g., 2567), convert to Gregorian for internal processing
    // This is a heuristic for strings parsed as B.E.
    if (dayjsDate.year() > 2400) {
        dayjsDate = dayjsDate.subtract(543, 'year');
    }

    return dayjsDate.format(format);
};

// --- Convenience Wrappers ---

// For "25 ธ.ค. 2024" (CE Year)
export const formatThaiDate = (date: any) => {
    return formatDate(date, 'D MMM YYYY');
};

// For "14:30"
export const formatTime = (date: any) => {
    return formatDate(date, TIME_FORMAT);
};

// For "25 ธ.ค. 2024 14:30"
export const formatDateTime = (date: any) => {
    return formatDate(date, 'D MMM YYYY HH:mm');
};

/**
 * Returns a relative time string (e.g., "เมื่อ 8 เดือนที่แล้ว")
 */
export const formatRelativeTime = (date: string | number | Date | null | undefined): string => {
    if (!date) return '';

    let dayjsDate;
    if (typeof date === 'string' && date.includes('/')) {
        dayjsDate = dayjs(date, 'DD/MM/YYYY');
        if (!dayjsDate.isValid()) {
            dayjsDate = dayjs(date);
        }
    } else {
        dayjsDate = dayjs(date);
    }

    if (!dayjsDate.isValid()) return '';

    if (dayjsDate.year() > 2400) {
        dayjsDate = dayjsDate.subtract(543, 'year');
    }

    return dayjsDate.fromNow();
};