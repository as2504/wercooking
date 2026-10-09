import { useNavigate } from 'react-router-dom';
import type { Order } from '@/types/models';
import { linesFromOrder } from '@/api/orders';
import { getSettings, listMenuItems } from '@/api/menu';
import { nextOrderableDate } from '@/lib/cutoff';
import { now } from '@/lib/clock';
import { relativeDay, MEAL_LABEL } from '@/lib/format';
import { indexItems } from '@/lib/pricing';
import { useCart } from '@/store/cart';
import { toast } from '@/store/toast';

/** Puts a past order's items into the cart for the next orderable date of that meal. */
export function useReorder() {
  const navigate = useNavigate();
  return async (order: Order) => {
    try {
      const [settings, items] = await Promise.all([getSettings(), listMenuItems()]);
      const index = indexItems(items);
      const all = linesFromOrder(order);
      const lines = all.filter((l) => {
        const ids = l.box ? [l.box.baseId, ...l.box.addonIds] : [l.itemId];
        return ids.every((id) => index[id] && !index[id].soldOut);
      });
      if (lines.length === 0) return toast.error('Can’t reorder', 'These items are sold out or unavailable right now.');
      const date = nextOrderableDate(order.mealType, now(), settings.windows);
      useCart.getState().replaceWith(order.mealType, date, lines);
      if (lines.length < all.length) toast.info('Some items skipped', 'Sold-out items were left out.');
      else toast.success('Added to cart', `${MEAL_LABEL[order.mealType]} for ${relativeDay(date, now())}`);
      navigate('/cart');
    } catch (e) {
      toast.error('Reorder failed', (e as Error).message);
    }
  };
}
