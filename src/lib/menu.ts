import type { DayMenu, ISODate, MealType, WeeklyMenu } from '@/types/models';
import type { ItemIndex } from './pricing';
import { weekdayOf } from './time';

export function dayMenuFor(date: ISODate, weekly: WeeklyMenu): DayMenu | undefined {
  return weekly.days.find((d) => d.day === weekdayOf(date));
}

/** One-line description of what a meal includes on a given date. */
export function mealLineup(meal: MealType, date: ISODate, weekly: WeeklyMenu, items: ItemIndex): string {
  const day = dayMenuFor(date, weekly);
  if (!day) return 'Kitchen closed on Sundays';
  if (meal === 'breakfast') return `Today's special: ${items[day.breakfastSpecial]?.name ?? 'Poha'} · or build your own box`;
  const sabji = meal === 'lunch' ? day.sabji : day.dinnerSabji;
  return `${sabji} · ${day.dal} · 4 roti · rice · salad`;
}
