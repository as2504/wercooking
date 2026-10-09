import type { FreshnessTag, KitchenUpdate } from '@/types/models';
import { now } from '@/lib/clock';
import { uid } from '@/lib/id';
import { istDate } from '@/lib/time';
import { ApiError, latency, patchById, read, write } from './base';

export async function listUpdates(): Promise<KitchenUpdate[]> {
  await latency();
  return (await read('kitchenUpdates')).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export interface PostUpdateInput {
  photo: string;
  note: string;
  oilUsed: string;
  vegetables: string[];
  freshness: FreshnessTag;
  author: string;
}

export async function postUpdate(input: PostUpdateInput): Promise<KitchenUpdate> {
  if (!input.photo) throw new ApiError('Add a photo of today\'s cooking.');
  if (input.note.trim().length < 10) throw new ApiError('Write a short note (at least 10 characters).');
  if (!input.oilUsed.trim()) throw new ApiError('Mention the oil used.');
  if (input.vegetables.length === 0) throw new ApiError('Add at least one vegetable.');
  await latency(300, 600);
  const t = now();
  const update: KitchenUpdate = {
    id: uid('k'),
    date: istDate(t),
    createdAt: t,
    photo: input.photo,
    note: input.note.trim(),
    oilUsed: input.oilUsed.trim(),
    vegetables: input.vegetables,
    freshness: input.freshness,
    author: input.author,
    heartedBy: [],
  };
  await write('kitchenUpdates', (all) => [update, ...all]);
  return update;
}

export async function deleteUpdate(id: string): Promise<void> {
  await write('kitchenUpdates', (all) => all.filter((u) => u.id !== id));
}

export async function toggleHeart(updateId: string, userId: string): Promise<KitchenUpdate> {
  return patchById<'kitchenUpdates', KitchenUpdate>('kitchenUpdates', updateId, (u) => ({
    ...u,
    heartedBy: u.heartedBy.includes(userId) ? u.heartedBy.filter((x) => x !== userId) : [...u.heartedBy, userId],
  }));
}
