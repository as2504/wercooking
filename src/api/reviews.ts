import type { Order, Review } from '@/types/models';
import { now } from '@/lib/clock';
import { uid } from '@/lib/id';
import { ApiError, latency, patchById, read, write } from './base';
import { pushNotification } from './notifications';

export async function listReviews(): Promise<Review[]> {
  await latency();
  return (await read('reviews')).slice().sort((a, b) => b.createdAt - a.createdAt);
}

export async function getReview(id: string): Promise<Review | undefined> {
  return (await read('reviews')).find((r) => r.id === id);
}

export async function rateOrder(order: Order, stars: number, comment: string): Promise<Review> {
  if (order.status !== 'picked_up') throw new ApiError('You can rate a meal after pickup.');
  if (order.reviewId) throw new ApiError('You have already rated this meal.');
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new ApiError('Choose 1 to 5 stars.');
  if (comment.length > 300) throw new ApiError('Keep the comment under 300 characters.');
  await latency();
  const review: Review = {
    id: uid('r'),
    orderId: order.id,
    userId: order.userId,
    userName: order.customerName,
    mealType: order.mealType,
    stars: stars as Review['stars'],
    comment: comment.trim(),
    createdAt: now(),
  };
  await write('reviews', (all) => [review, ...all]);
  await patchById<'orders', Order>('orders', order.id, (o) => ({ ...o, reviewId: review.id }));
  await pushNotification('admin', `${'⭐'.repeat(review.stars)} from ${review.userName}`, review.comment || `Rated ${order.number}`, '/admin/reports');
  return review;
}
