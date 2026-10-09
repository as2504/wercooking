import type { Coupon, DayMenu, KitchenSettings, MenuItem, WeeklyMenu } from '@/types/models';
import { now } from '@/lib/clock';
import { ApiError, latency, patchById, read, write } from './base';

export async function listMenuItems(): Promise<MenuItem[]> {
  await latency(80, 220);
  return (await read('menuItems')).slice().sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function updateMenuItem(id: string, patch: Partial<Omit<MenuItem, 'id'>>): Promise<MenuItem> {
  await latency();
  if (patch.price !== undefined && (!Number.isFinite(patch.price) || patch.price < 0 || patch.price > 2000))
    throw new ApiError('Price must be between ₹0 and ₹2000.');
  if (patch.name !== undefined && !patch.name.trim()) throw new ApiError('Name is required.');
  return patchById<'menuItems', MenuItem>('menuItems', id, (m) => ({ ...m, ...patch }));
}

export async function getWeeklyMenu(): Promise<WeeklyMenu> {
  await latency(60, 160);
  return read('weeklyMenu');
}

export async function updateDayMenu(day: DayMenu): Promise<WeeklyMenu> {
  await latency();
  if (!day.sabji.trim() || !day.dal.trim() || !day.dinnerSabji.trim()) throw new ApiError('Sabji and dal are required.');
  return write('weeklyMenu', (w) => ({ days: w.days.map((d) => (d.day === day.day ? day : d)), updatedAt: now() }));
}

export async function listCoupons(): Promise<Coupon[]> {
  return read('coupons');
}

export async function getSettings(): Promise<KitchenSettings> {
  return read('settings');
}

export async function updateSettings(patch: Partial<KitchenSettings>): Promise<KitchenSettings> {
  await latency();
  return write('settings', (s) => ({ ...s, ...patch }));
}
