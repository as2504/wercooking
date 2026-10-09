import { useLiveQuery } from './useLiveQuery';
import { getSettings, getWeeklyMenu, listCoupons, listMenuItems } from '@/api/menu';
import { indexItems, type ItemIndex } from '@/lib/pricing';
import type { Coupon, KitchenSettings, MenuItem, WeeklyMenu } from '@/types/models';

export interface Catalog {
  items: MenuItem[];
  index: ItemIndex;
  weekly: WeeklyMenu;
  settings: KitchenSettings;
  coupons: Coupon[];
}

/** Menu, weekly menu, settings and coupons, kept live across tabs. */
export function useCatalog() {
  return useLiveQuery<Catalog>(
    async () => {
      const [items, weekly, settings, coupons] = await Promise.all([listMenuItems(), getWeeklyMenu(), getSettings(), listCoupons()]);
      return { items, index: indexItems(items), weekly, settings, coupons };
    },
    ['menuItems', 'weeklyMenu', 'settings', 'coupons'],
  );
}
