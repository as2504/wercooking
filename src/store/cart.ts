import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BoxConfig, Cart, CartLine, ISODate, MealType } from '@/types/models';
import { uid } from '@/lib/id';

const EMPTY: Cart = { mealType: null, date: null, slotId: null, lines: [], couponCode: null, note: '' };

interface CartState extends Cart {
  /** What the Menu screen is currently showing (independent of cart contents). */
  browseMeal: MealType;
  browseDate: ISODate | null;
  setBrowse: (meal: MealType, date: ISODate | null) => void;
  /** Returns false (and changes nothing) if the cart holds a different meal/date. */
  canAdd: (meal: MealType, date: ISODate) => boolean;
  addItem: (meal: MealType, date: ISODate, itemId: string, qty?: number) => void;
  addBox: (meal: MealType, date: ISODate, box: BoxConfig, qty: number) => void;
  setQty: (lineId: string, qty: number) => void;
  setItemQty: (meal: MealType, date: ISODate, itemId: string, qty: number) => void;
  setSlot: (slotId: string | null) => void;
  setCoupon: (code: string | null) => void;
  setNote: (note: string) => void;
  moveTo: (date: ISODate) => void;
  replaceWith: (meal: MealType, date: ISODate, lines: CartLine[]) => void;
  clear: () => void;
}

const sameBox = (a?: BoxConfig, b?: BoxConfig) =>
  !!a && !!b && a.baseId === b.baseId && [...a.addonIds].sort().join() === [...b.addonIds].sort().join();

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      browseMeal: 'lunch',
      browseDate: null,
      setBrowse: (browseMeal, browseDate) => set({ browseMeal, browseDate }),
      canAdd: (meal, date) => {
        const s = get();
        return s.lines.length === 0 || (s.mealType === meal && s.date === date);
      },
      addItem: (meal, date, itemId, qty = 1) => {
        const s = get();
        if (!s.canAdd(meal, date)) return;
        const existing = s.lines.find((l) => l.itemId === itemId && !l.box);
        const lines = existing
          ? s.lines.map((l) => (l === existing ? { ...l, qty: Math.min(20, l.qty + qty) } : l))
          : [...s.lines, { id: uid('l'), itemId, qty }];
        set({ mealType: meal, date, lines, slotId: s.mealType === meal && s.date === date ? s.slotId : null });
      },
      addBox: (meal, date, box, qty) => {
        const s = get();
        if (!s.canAdd(meal, date)) return;
        const existing = s.lines.find((l) => sameBox(l.box, box));
        const lines = existing
          ? s.lines.map((l) => (l === existing ? { ...l, qty: Math.min(20, l.qty + qty) } : l))
          : [...s.lines, { id: uid('l'), itemId: box.baseId, qty, box }];
        set({ mealType: meal, date, lines, slotId: s.mealType === meal && s.date === date ? s.slotId : null });
      },
      setQty: (lineId, qty) => {
        const lines = qty <= 0 ? get().lines.filter((l) => l.id !== lineId) : get().lines.map((l) => (l.id === lineId ? { ...l, qty: Math.min(20, qty) } : l));
        set(lines.length ? { lines } : { ...EMPTY });
      },
      setItemQty: (meal, date, itemId, qty) => {
        const line = get().lines.find((l) => l.itemId === itemId && !l.box);
        if (line) get().setQty(line.id, qty);
        else if (qty > 0) get().addItem(meal, date, itemId, qty);
      },
      setSlot: (slotId) => set({ slotId }),
      setCoupon: (couponCode) => set({ couponCode }),
      setNote: (note) => set({ note: note.slice(0, 200) }),
      moveTo: (date) => set({ date, slotId: null }),
      replaceWith: (meal, date, lines) => set({ ...EMPTY, mealType: meal, date, lines }),
      clear: () => set({ ...EMPTY }),
    }),
    { name: 'wac:cart', version: 1 },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.qty, 0);
