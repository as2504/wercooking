import type { User } from '@/types/models';
import { ApiError, latency, patchById, read } from './base';
import { getSessionUserId } from './session';

export async function getCurrentUser(): Promise<User | null> {
  const id = getSessionUserId();
  if (!id) return null;
  const users = await read('users');
  return users.find((u) => u.id === id) ?? null;
}

export async function getUser(id: string): Promise<User> {
  const user = (await read('users')).find((u) => u.id === id);
  if (!user) throw new ApiError('User not found.', 'not_found');
  return user;
}

export async function listUsers(): Promise<User[]> {
  await latency();
  return read('users');
}

export type ProfilePatch = Partial<Pick<User, 'name' | 'area' | 'diet' | 'spice' | 'allergies'>>;

export async function updateProfile(id: string, patch: ProfilePatch): Promise<User> {
  await latency();
  if (patch.name !== undefined && patch.name.trim().length < 2) throw new ApiError('Name must be at least 2 characters.');
  return patchById<'users', User>('users', id, (u) => ({ ...u, ...patch }));
}
