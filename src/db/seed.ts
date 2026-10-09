// Realistic demo data, generated relative to "now" so the last 7 days always have history.
// Deterministic (seeded PRNG) so every reset looks the same for a given day.
import type {
  Coupon, DayMenu, KitchenSettings, KitchenUpdate, MealType, MenuItem, Millis, Order, OrderStatus,
  Review, Subscription, User, WeeklyMenu, FreshnessTag, ISODate, OrderItem,
} from '@/types/models';
import { DEFAULT_WINDOWS, cutoffAt, isServiceDay, slotsFor } from '@/lib/cutoff';
import { DEFAULT_PLAN_PRICES, indexItems, planQuote } from '@/lib/pricing';
import { buildPlanDays, perMealValue } from '@/lib/subscription';
import { orderNumber, planMealItem } from '@/lib/orders';
import { addDays, istAt, istDate, weekdayOf } from '@/lib/time';
import { dishIllustration } from './illustrations';
import type { Collections } from './storage';

export const SCHEMA_VERSION = 1;

export const SEED_MENU: MenuItem[] = [
  { id: 't_regular', name: 'Regular Thali', description: 'Sabji of the day, dal, 4 phulkas, jeera rice, salad & pickle.', category: 'thali', price: 110, subPrice: 100, diet: 'veg', meals: ['lunch', 'dinner'], soldOut: false, emoji: '🍛', sortOrder: 1 },
  { id: 't_mini', name: 'Mini Thali', description: 'For students: sabji, dal, 3 phulkas & rice. Same home taste, smaller plate.', category: 'thali', price: 85, diet: 'veg', meals: ['lunch', 'dinner'], soldOut: false, emoji: '🥘', sortOrder: 2 },
  { id: 'b_poha', name: 'Kanda Poha', description: 'Light poha with onion, peanuts, curry leaves & lemon.', category: 'breakfast_base', price: 45, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🍚', sortOrder: 10 },
  { id: 'b_upma', name: 'Rava Upma', description: 'Soft upma with veggies, ghee tadka & coconut.', category: 'breakfast_base', price: 45, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🥣', sortOrder: 11 },
  { id: 'b_idli', name: 'Idli Sambar', description: '3 soft idlis with sambar & coconut chutney.', category: 'breakfast_base', price: 50, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🍥', sortOrder: 12 },
  { id: 'b_chilla', name: 'Besan Chilla', description: '2 protein-rich besan chillas with green chutney.', category: 'breakfast_base', price: 55, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🫓', sortOrder: 13 },
  { id: 'b_oats', name: 'Masala Oats', description: 'Savoury oats with carrots, peas & beans. High fibre.', category: 'breakfast_base', price: 60, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🌾', sortOrder: 14 },
  { id: 'a_eggs', name: 'Boiled eggs', description: 'Two farm eggs, boiled & halved.', category: 'breakfast_addon', price: 14, diet: 'egg', meals: ['breakfast'], soldOut: false, emoji: '🥚', unitLabel: '2 eggs', sortOrder: 20 },
  { id: 'a_sprouts', name: 'Sprouts', description: 'Moong sprouts chaat with onion, tomato & lemon.', category: 'breakfast_addon', price: 15, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🌱', unitLabel: '1 cup', sortOrder: 21 },
  { id: 'a_fruit', name: 'Fruit bowl', description: 'Seasonal cut fruit.', category: 'breakfast_addon', price: 20, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🍉', unitLabel: '150 g', sortOrder: 22 },
  { id: 'a_chikki', name: 'Peanut chikki', description: 'Jaggery peanut chikki from Lonavala.', category: 'breakfast_addon', price: 10, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🥜', unitLabel: '1 piece', sortOrder: 23 },
  { id: 'i_poha_only', name: 'Poha only', description: 'Just a bowl of kanda poha. Quick & cheap.', category: 'breakfast_item', price: 25, diet: 'veg', meals: ['breakfast'], soldOut: false, emoji: '🍚', sortOrder: 30 },
  { id: 'm_roti', name: 'Extra roti', description: 'One extra soft phulka.', category: 'meal_addon', price: 10, diet: 'veg', meals: ['lunch', 'dinner'], soldOut: false, emoji: '🫓', unitLabel: '1 phulka', sortOrder: 40 },
  { id: 'm_eggcurry', name: 'Egg curry', description: '2 eggs in onion-tomato gravy.', category: 'meal_addon', price: 30, diet: 'egg', meals: ['lunch', 'dinner'], soldOut: false, emoji: '🍳', unitLabel: '2 eggs', sortOrder: 41 },
  { id: 'm_curd', name: 'Curd', description: 'Fresh homemade dahi.', category: 'meal_addon', price: 15, diet: 'veg', meals: ['lunch', 'dinner'], soldOut: false, emoji: '🥛', unitLabel: '100 g', sortOrder: 42 },
];

export const SEED_WEEK: DayMenu[] = [
  { day: 1, sabji: 'Aloo gobi', dal: 'Dal tadka', dinnerSabji: 'Mix veg', breakfastSpecial: 'b_poha' },
  { day: 2, sabji: 'Bhindi masala', dal: 'Moong dal', dinnerSabji: 'Matki usal', breakfastSpecial: 'b_upma' },
  { day: 3, sabji: 'Chole', dal: 'Masoor dal', dinnerSabji: 'Baingan bharta', breakfastSpecial: 'b_chilla' },
  { day: 4, sabji: 'Methi aloo', dal: 'Dal fry', dinnerSabji: 'Shimla mirch besan', breakfastSpecial: 'b_idli' },
  { day: 5, sabji: 'Patta gobi', dal: 'Rajma', dinnerSabji: 'Sev bhaji', breakfastSpecial: 'b_oats' },
  { day: 6, sabji: 'Paneer masala', dal: 'Toor dal amti', dinnerSabji: 'Pithla', breakfastSpecial: 'b_poha' },
];

export const SEED_COUPONS: Coupon[] = [
  { code: 'WELCOME20', description: '₹20 off your first order (min ₹80)', amountOff: 20, minOrder: 80, firstOrderOnly: true, active: true },
  { code: 'STUDENT10', description: '₹10 off on orders above ₹85', amountOff: 10, minOrder: 85, firstOrderOnly: false, active: true },
];

export const SEED_SETTINGS: KitchenSettings = {
  windows: DEFAULT_WINDOWS,
  planPrices: DEFAULT_PLAN_PRICES,
  cookName: 'Tai',
  kitchenAddress: 'Shop 4, Sai Krupa Society, near Akurdi Railway Station, Akurdi, Pune 411035 (demo address)',
  fssaiNumber: 'DEMO-11526999000123',
  adminPin: '1234',
};

const CUSTOMERS: [string, string][] = [
  ['Aditya Kulkarni', 'Sector 26, Pradhikaran'], ['Sneha Patil', 'Akurdi Station Road'],
  ['Rohan Deshmukh', 'Nigdi'], ['Priya Nair', 'Ravet'], ['Karthik Iyer', 'Chinchwad'],
  ['Ananya Joshi', 'Akurdi, near D.Y. Patil'], ['Vikram Shinde', 'Sector 26, Pradhikaran'],
  ['Neha Gupta', 'Nigdi'], ['Saurabh Jadhav', 'Akurdi Station Road'], ['Meera Pillai', 'Ravet'],
  ['Arjun Reddy', 'Chinchwad'], ['Pooja Bhosale', 'Akurdi, near D.Y. Patil'],
];

const REVIEW_COMMENTS = [
  'Tastes just like home. Rotis were soft.', 'Dal was perfect, not oily at all.', 'Good portion, worth the price.',
  'Poha was fresh and warm at pickup.', 'Loved the sprouts add-on!', 'Sabji was a little salty today.',
  'Packing was neat, nothing leaked.', '', '', 'Pickup was quick, ready on time.', 'Could be a bit more spicy.',
];

const VEG_BY_DAY: Record<number, string[]> = {
  1: ['Potato', 'Cauliflower', 'Tomato', 'Coriander', 'Carrot', 'Beans'],
  2: ['Bhindi', 'Onion', 'Matki sprouts', 'Tomato', 'Green chilli'],
  3: ['Kabuli chana', 'Brinjal', 'Onion', 'Tomato', 'Spring onion'],
  4: ['Methi', 'Potato', 'Capsicum', 'Garlic', 'Ginger'],
  5: ['Cabbage', 'Peas', 'Rajma', 'Tomato', 'Coriander'],
  6: ['Paneer', 'Capsicum', 'Onion', 'Tomato', 'Green chilli'],
};

const NOTES = [
  'Fresh methi from Akurdi mandi today. Dal is slow-cooked since 7 AM.',
  'Rotis made with chakki atta. We switched to less oil in the sabji this week.',
  'All vegetables washed in potassium permanganate solution before chopping.',
  'Tai\'s special amti today. Rice is Indrayani, sourced from Maval.',
  'Kitchen deep-cleaned last night. Fresh batch of pickle opened today.',
  'Cooler weather, so a slightly spicier sabji today. Curd set fresh overnight.',
  'Breakfast boxes packed in new leak-proof containers.',
];

const FRESHNESS: FreshnessTag[] = ['Farm fresh today', 'Bought this morning', 'Seasonal pick', 'Locally sourced'];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Status an order would have reached at `nowMs`, given its pickup slot. */
function progressFor(slotStartMs: Millis, cutoffMs: Millis, nowMs: Millis, rand: () => number) {
  const steps: { status: OrderStatus; at: Millis }[] = [];
  const t = {
    accepted: cutoffMs + 10 * 60_000,
    cooking: slotStartMs - 80 * 60_000 + Math.floor(rand() * 10) * 60_000,
    packed: slotStartMs - 30 * 60_000 + Math.floor(rand() * 8) * 60_000,
    ready: slotStartMs - 10 * 60_000,
    picked_up: slotStartMs + Math.floor(rand() * 28) * 60_000,
  };
  for (const s of ['accepted', 'cooking', 'packed', 'ready', 'picked_up'] as const) {
    if (nowMs >= t[s]) steps.push({ status: s, at: t[s] });
  }
  return { steps, t };
}

export function buildSeed(nowMs: Millis): Collections {
  const rand = mulberry32(Number(istDate(nowMs).replace(/-/g, '')));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const items = indexItems(SEED_MENU);
  const weekly: WeeklyMenu = { days: SEED_WEEK, updatedAt: nowMs };
  const today = istDate(nowMs);
  const windows = SEED_SETTINGS.windows;

  const users: User[] = CUSTOMERS.map(([name, area], i) => ({
    id: `u_seed${i + 1}`,
    phone: `98${String(22000000 + i * 137531).slice(0, 8)}`,
    name,
    area,
    diet: i % 3 === 0 ? 'egg' : 'veg',
    spice: (['mild', 'medium', 'spicy'] as const)[i % 3],
    allergies: i === 4 ? 'Peanuts' : '',
    walletBalance: Math.round(rand() * 20) * 10,
    createdAt: nowMs - (20 + i) * 86_400_000,
    hasOrdered: true,
  }));

  let counter = 1001;
  const orders: Order[] = [];
  const reviews: Review[] = [];

  const makeOrder = (user: User, meal: MealType, date: ISODate, orderItems: OrderItem[], extra: Partial<Order> = {}) => {
    const slot = pick(slotsFor(meal, windows));
    const cutoff = cutoffAt(meal, date, windows);
    const slotStart = istAt(date, slot.start);
    const createdAt = cutoff - Math.floor(2 + rand() * 30) * 3_600_000 / 2;
    const { steps } = progressFor(slotStart, cutoff, nowMs, rand);
    const subtotal = orderItems.reduce((s, i) => s + i.lineTotal, 0);
    const history = [{ status: 'placed' as OrderStatus, at: createdAt }, ...steps];
    const status = history[history.length - 1].status;
    const order: Order = {
      id: `o_seed${counter}`,
      number: orderNumber(counter++),
      userId: user.id,
      customerName: user.name,
      customerPhone: user.phone,
      mealType: meal,
      pickupDate: date,
      slot,
      items: orderItems,
      subtotal,
      discount: 0,
      total: subtotal,
      couponCode: null,
      note: rand() < 0.12 ? pick(['Less oil please', 'No onion', 'Extra chutney', 'Less spicy']) : '',
      status,
      statusHistory: history,
      createdAt,
      cookedAt: steps.find((s) => s.status === 'cooking')?.at,
      packedAt: steps.find((s) => s.status === 'packed')?.at,
      cookedBy: steps.some((s) => s.status === 'cooking') ? SEED_SETTINGS.cookName : undefined,
      pickupCode: String(1000 + Math.floor(rand() * 9000)),
      paymentId: null,
      paymentState: 'paid',
      source: 'single',
      ...extra,
    };
    if (status === 'picked_up' && rand() < 0.5) {
      const stars = (rand() < 0.7 ? 5 : rand() < 0.7 ? 4 : 3) as Review['stars'];
      const review: Review = {
        id: `r_${order.id}`,
        orderId: order.id,
        userId: user.id,
        userName: user.name,
        mealType: meal,
        stars,
        comment: pick(REVIEW_COMMENTS),
        createdAt: history[history.length - 1].at + 2 * 3_600_000,
      };
      if (review.createdAt <= nowMs) {
        reviews.push(review);
        order.reviewId = review.id;
      }
    }
    orders.push(order);
    return order;
  };

  const singleItems = (meal: MealType): OrderItem[] => {
    const line = (id: string, qty = 1): OrderItem => ({
      itemId: id, name: items[id].name, emoji: items[id].emoji, qty, unitPrice: items[id].price, lineTotal: items[id].price * qty,
    });
    if (meal === 'breakfast') {
      if (rand() < 0.15) return [line('i_poha_only')];
      const base = items[pick(['b_poha', 'b_upma', 'b_idli', 'b_chilla', 'b_oats'])];
      const addons = ['a_eggs', 'a_sprouts', 'a_fruit', 'a_chikki'].filter(() => rand() < 0.35).map((id) => items[id]);
      const price = base.price + addons.reduce((s, a) => s + a.price, 0);
      return [{
        itemId: base.id, name: `Breakfast Box: ${base.name}`, emoji: base.emoji, qty: 1, unitPrice: price, lineTotal: price,
        box: { base: { id: base.id, name: base.name, price: base.price }, addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price })) },
      }];
    }
    const out = [line(rand() < 0.75 ? 't_regular' : 't_mini')];
    if (rand() < 0.35) out.push(line('m_roti', rand() < 0.5 ? 1 : 2));
    if (rand() < 0.15) out.push(line('m_eggcurry'));
    if (rand() < 0.2) out.push(line('m_curd'));
    return out;
  };

  // Single orders: past 7 days, today, and tomorrow's breakfast.
  for (let offset = -7; offset <= 1; offset++) {
    const date = addDays(today, offset);
    if (!isServiceDay(date)) continue;
    for (const meal of ['breakfast', 'lunch', 'dinner'] as MealType[]) {
      if (offset === 1 && meal !== 'breakfast') continue;
      // Only include orders that would have been placed by now.
      const n = Math.floor((meal === 'lunch' ? 7 : 4) + rand() * 5);
      for (let k = 0; k < n; k++) {
        const o = makeOrder(pick(users), meal, date, singleItems(meal));
        if (o.createdAt > nowMs) orders.pop();
        else if (offset < 0 && rand() < 0.04) {
          o.status = 'cancelled';
          o.statusHistory = [o.statusHistory[0], { status: 'cancelled', at: o.createdAt + 3_600_000 }];
          o.cookedAt = o.packedAt = o.cookedBy = undefined;
          o.paymentState = 'refunded';
          o.cancelReason = 'Cancelled by customer before cutoff';
          o.reviewId = undefined;
        }
      }
    }
  }

  // Subscriptions for some seed customers, started in the past.
  const subSpecs: [number, Subscription['plan'], Subscription['meal'], number][] = [
    [0, 'monthly', 'lunch', -9], [1, 'weekly', 'combo', -3], [3, 'monthly', 'breakfast', -6],
    [6, 'weekly', 'dinner', -2], [8, 'monthly', 'combo', -12],
  ];
  const subscriptions: Subscription[] = subSpecs.map(([ui, plan, meal, startOffset], i) => {
    const user = users[ui];
    let start = addDays(today, startOffset);
    while (!isServiceDay(start)) start = addDays(start, 1);
    const quote = planQuote(plan, meal, SEED_SETTINGS.planPrices);
    const sub: Subscription = {
      id: `s_seed${i + 1}`,
      userId: user.id,
      customerName: user.name,
      plan,
      meal,
      pricePerDay: quote.pricePerDay,
      serviceDays: quote.days,
      amount: quote.total,
      startDate: start,
      slots: Object.fromEntries((meal === 'combo' ? ['lunch', 'dinner'] : [meal]).map((m) => [m, slotsFor(m as MealType, windows)[1].id])),
      days: buildPlanDays(plan, meal, start),
      status: 'active',
      paymentId: null,
      createdAt: istAt(addDays(start, -2), '19:00'),
      creditedBack: 0,
    };
    const value = perMealValue(sub);
    sub.days = sub.days.map((d) => {
      if (nowMs < cutoffAt(d.meal, d.date, windows)) return d;
      if (rand() < 0.08 && d.date < today) {
        sub.creditedBack += value;
        return { ...d, state: 'skipped' };
      }
      const o = makeOrder(user, d.meal, d.date, [planMealItem(d.meal, d.date, weekly, items, value)], {
        source: 'subscription', subscriptionId: sub.id, paymentState: 'prepaid_plan',
      });
      return { ...d, orderId: o.id, state: o.status === 'picked_up' ? 'delivered' : 'ordered' };
    });
    return sub;
  });

  // Kitchen updates for the last week (today's appears after 10:30 AM).
  const kitchenUpdates: KitchenUpdate[] = [];
  for (let offset = -7; offset <= 0; offset++) {
    const date = addDays(today, offset);
    if (!isServiceDay(date)) continue;
    const createdAt = istAt(date, '10:30');
    if (createdAt > nowMs) continue;
    const wd = weekdayOf(date);
    const day = SEED_WEEK.find((d) => d.day === wd)!;
    const veg = VEG_BY_DAY[wd];
    kitchenUpdates.push({
      id: `k_seed_${date}`,
      date,
      createdAt: createdAt + Math.floor(rand() * 40) * 60_000,
      photo: dishIllustration(['🍛', '🫓', '🥗', '🍚', '🥒', '🌶️'].slice(0, 4 + (wd % 3)), wd, `${day.sabji} · ${day.dal}`),
      note: NOTES[(wd + offset + 7) % NOTES.length],
      oilUsed: wd % 2 ? 'Cold-pressed groundnut oil · 900 ml for ~55 meals' : 'Sunflower oil · 850 ml for ~50 meals',
      vegetables: veg,
      freshness: FRESHNESS[(wd + 1) % FRESHNESS.length],
      author: SEED_SETTINGS.cookName,
      heartedBy: users.filter(() => rand() < 0.45).map((u) => u.id),
    });
  }
  kitchenUpdates.sort((a, b) => b.createdAt - a.createdAt);

  return {
    meta: { schemaVersion: SCHEMA_VERSION, seededAt: nowMs, orderCounter: counter, invoiceCounter: 1 },
    settings: SEED_SETTINGS,
    users,
    menuItems: SEED_MENU,
    weeklyMenu: weekly,
    coupons: SEED_COUPONS,
    orders: orders.sort((a, b) => b.createdAt - a.createdAt),
    payments: [],
    subscriptions,
    walletTxns: [],
    kitchenUpdates,
    reviews,
    notifications: [],
  };
}
