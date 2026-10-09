import type { ISODate, MealType, Millis, OrderStatus } from '@/types/models';
import { addDays, istAt, istDate, istParts } from './time';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });

export const rupees = (n: number) => inr.format(n);
export const rupees2 = (n: number) => inr2.format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const dayShort = (wd: number) => DAYS[wd];
export const dayLong = (wd: number) => DAYS_LONG[wd];

/** "21:00" -> "9:00 PM" */
export function hhmm12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "9:05 PM" in IST */
export function time12(ms: Millis): string {
  const p = istParts(ms);
  return hhmm12(`${p.hours}:${p.minutes}`);
}

/** "Thu, 9 Oct" (Indian day-month order) */
export function dateShort(date: ISODate | Millis): string {
  const ms = typeof date === 'number' ? date : istAt(date, '12:00');
  const p = istParts(ms);
  return `${DAYS[p.weekday]}, ${p.day} ${MONTHS[p.month - 1]}`;
}

/** "09/10/2026" */
export function dateNumeric(ms: Millis): string {
  const p = istParts(ms);
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}

export function dateTime(ms: Millis): string {
  return `${dateShort(ms)}, ${time12(ms)}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Thu, 9 Oct" relative to now. */
export function relativeDay(date: ISODate, nowMs: Millis): string {
  const today = istDate(nowMs);
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  if (date === addDays(today, -1)) return 'Yesterday';
  return dateShort(date);
}

/** "2h 15m", "45m", "30s" */
export function duration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(1, Math.floor(ms / 1000))}s`;
}

export function timeAgo(ms: Millis, nowMs: Millis): string {
  const diff = nowMs - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return dateShort(ms);
}

export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
export const MEAL_EMOJI: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙' };

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  cooking: 'Cooking',
  packed: 'Packed',
  ready: 'Ready for pickup',
  picked_up: 'Picked up',
  cancelled: 'Cancelled',
};

export function formatPhone(phone: string): string {
  return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
}
