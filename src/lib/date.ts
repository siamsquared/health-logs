import dayjs from 'dayjs';
import 'dayjs/locale/th'; // Import Thai locale
import buddhistEra from 'dayjs/plugin/buddhistEra'; // Optional: For Thai Years (2567)

// Setup plugins
dayjs.extend(buddhistEra);
dayjs.locale('th'); // Set default global locale to Thai

// Standard formats constants (Easy to change later)
export const DATE_FORMAT = 'D MMM YYYY';      // 25 ธ.ค. 2023
export const TIME_FORMAT = 'HH:mm';           // 14:30
export const DATETIME_FORMAT = 'D MMM YYYY HH:mm';

/**
 * Reusable Date Formatter
 * @param date - The date string, timestamp, or Date object
 * @param format - (Optional) The output pattern
 * @returns Formatted string or "-" if invalid
 */
export const formatDate = (
    date: string | number | Date | null | undefined,
    format: string = DATE_FORMAT
): string => {
    if (!date) return '-';

    const dayjsDate = dayjs(date);

    // Check if date is valid
    if (!dayjsDate.isValid()) return '-';

    return dayjsDate.format(format);
};

// --- Convenience Wrappers (Optional but helpful) ---

// For "25 ธ.ค. 2567" (Thai Year)
export const formatThaiDate = (date: any) => {
    return formatDate(date, 'D MMM BB'); // 'BB' is from buddhistEra plugin
};

// For "14:30"
export const formatTime = (date: any) => {
    return formatDate(date, TIME_FORMAT);
};

// For "25 ธ.ค. 2567 14:30"
export const formatDateTime = (date: any) => {
    return formatDate(date, 'D MMM BB HH:mm');
};