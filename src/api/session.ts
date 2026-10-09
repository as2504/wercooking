// Mock auth. Any 4-digit OTP is accepted. A real backend would issue a token here.
import type { Diet, SpiceLevel, User } from '@/types/models';
import { now } from '@/lib/clock';
import { uid } from '@/lib/id';
import { ApiError, latency, read, write } from './base';
import { pushNotification } from './notifications';

const SESSION_KEY = 'wac:session';
const ADMIN_KEY = 'wac:adminUnlocked';

export function getSessionUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function setSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId);
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* ignore */
  }
}

export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

export async function requestOtp(phone: string): Promise<{ hint: string }> {
  if (!isValidIndianMobile(phone)) throw new ApiError('Enter a valid 10-digit Indian mobile number.');
  await latency(400, 800);
  return { hint: 'Demo mode: any 4 digits will work.' };
}

/** Returns the existing user (and signs in) or null if a profile must be created. */
export async function verifyOtp(phone: string, otp: string): Promise<User | null> {
  if (!/^\d{4}$/.test(otp)) throw new ApiError('Enter the 4-digit code.');
  await latency(400, 800);
  const users = await read('users');
  const existing = users.find((u) => u.phone === phone);
  if (existing) setSession(existing.id);
  return existing ?? null;
}

export interface ProfileInput {
  phone: string;
  name: string;
  area: string;
  diet: Diet;
  spice: SpiceLevel;
  allergies: string;
}

export async function createProfile(input: ProfileInput): Promise<User> {
  await latency();
  const user: User = {
    id: uid('u'),
    phone: input.phone,
    name: input.name.trim(),
    area: input.area.trim(),
    diet: input.diet,
    spice: input.spice,
    allergies: input.allergies.trim(),
    walletBalance: 0,
    createdAt: now(),
    hasOrdered: false,
  };
  await write('users', (users) => [...users.filter((u) => u.phone !== user.phone), user]);
  setSession(user.id);
  await pushNotification(user.id, `Welcome, ${user.name.split(' ')[0]}! 🙏`, 'Use code WELCOME20 for ₹20 off your first order.', '/menu');
  return user;
}

export function logout() {
  clearSession();
}

export function isAdminUnlocked(): boolean {
  try {
    return localStorage.getItem(ADMIN_KEY) === '1';
  } catch {
    return false;
  }
}

export async function unlockAdmin(pin: string): Promise<void> {
  const settings = await read('settings');
  await latency(150, 300);
  if (pin !== settings.adminPin) throw new ApiError('Incorrect PIN.');
  localStorage.setItem(ADMIN_KEY, '1');
}

export function lockAdmin() {
  localStorage.removeItem(ADMIN_KEY);
}
