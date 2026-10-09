// Domain models for WeAreCooking. These are the contract between UI and the api/ layer;
// a real backend should return these same shapes.

export type ID = string;
/** Calendar date in IST, formatted YYYY-MM-DD. */
export type ISODate = string;
/** Epoch milliseconds. */
export type Millis = number;

export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type Diet = 'veg' | 'egg';
export type SpiceLevel = 'mild' | 'medium' | 'spicy';

export interface User {
  id: ID;
  phone: string; // 10 digits, no country code
  name: string;
  area: string;
  diet: Diet;
  spice: SpiceLevel;
  allergies: string;
  walletBalance: number;
  createdAt: Millis;
  /** True once the user has placed any paid order (used for first-order coupons). */
  hasOrdered: boolean;
}

export type MenuCategory =
  | 'thali'
  | 'breakfast_base'
  | 'breakfast_addon'
  | 'breakfast_item'
  | 'meal_addon';

export interface MenuItem {
  id: ID;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  /** Price per meal when bought as part of a subscription, if different. */
  subPrice?: number;
  diet: Diet;
  meals: MealType[];
  soldOut: boolean;
  /** Emoji used as a lightweight illustration. */
  emoji: string;
  /** Short qualifier shown under add-ons, e.g. "2 eggs". */
  unitLabel?: string;
  sortOrder: number;
}

/** 1 = Monday ... 6 = Saturday. Sunday (0) is a kitchen holiday. */
export type ServiceDay = 1 | 2 | 3 | 4 | 5 | 6;

export interface DayMenu {
  day: ServiceDay;
  sabji: string;
  dal: string;
  /** Menu item id of the day's suggested breakfast base (also used for breakfast plans). */
  breakfastSpecial: ID;
  dinnerSabji: string;
}

export interface WeeklyMenu {
  days: DayMenu[];
  updatedAt: Millis;
}

export interface BoxConfig {
  baseId: ID;
  addonIds: ID[];
}

export interface CartLine {
  id: ID;
  itemId: ID;
  qty: number;
  /** Present when the line is a Build-a-Box breakfast. */
  box?: BoxConfig;
}

export interface Cart {
  mealType: MealType | null;
  date: ISODate | null;
  slotId: string | null;
  lines: CartLine[];
  couponCode: string | null;
  note: string;
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'cooking'
  | 'packed'
  | 'ready'
  | 'picked_up'
  | 'cancelled';

export interface OrderItem {
  itemId: ID;
  name: string;
  emoji: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  /** For breakfast boxes: the chosen base and add-ons with the prices at order time. */
  box?: { base: { id: ID; name: string; price: number }; addons: { id: ID; name: string; price: number }[] };
}

export interface Slot {
  id: string; // e.g. "lunch-1230"
  meal: MealType;
  start: string; // "12:30"
  end: string; // "13:00"
  label: string; // "12:30 – 1:00 PM"
}

export type PaymentState = 'unpaid' | 'paid' | 'refunded' | 'prepaid_plan';

export interface Order {
  id: ID;
  /** Short human number shown in UI, e.g. "WAC-1042". */
  number: string;
  userId: ID;
  customerName: string;
  customerPhone: string;
  mealType: MealType;
  pickupDate: ISODate;
  slot: Slot;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
  note: string;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Millis }[];
  createdAt: Millis;
  cookedAt?: Millis;
  packedAt?: Millis;
  cookedBy?: string;
  pickupCode: string; // 4 digits
  paymentId: ID | null;
  paymentState: PaymentState;
  source: 'single' | 'subscription';
  subscriptionId?: ID;
  reviewId?: ID;
  cancelReason?: string;
}

export type PaymentMethod = 'upi_id' | 'upi_app' | 'upi_qr' | 'wallet';
export type PaymentStatus = 'processing' | 'pending' | 'success' | 'failed' | 'timeout';
export type PaymentPurpose = 'order' | 'subscription' | 'wallet_topup';
export type SimOutcome = 'success' | 'failed' | 'pending' | 'timeout';

export interface Payment {
  id: ID;
  userId: ID;
  purpose: PaymentPurpose;
  /** Order id, subscription id, or wallet txn id depending on purpose. */
  refId: ID | null;
  amount: number;
  method: PaymentMethod;
  upiId?: string;
  appLabel?: string;
  status: PaymentStatus;
  failureReason?: string;
  /** Simulated gateway transaction id. */
  txnId: string;
  /** Simulated 12-digit UPI reference (RRN). */
  upiRef?: string;
  attempt: number;
  createdAt: Millis;
  completedAt?: Millis;
  receiptNo?: string;
  invoiceNo?: string;
}

export type PlanLength = 'weekly' | 'monthly';
export type PlanMeal = 'breakfast' | 'lunch' | 'dinner' | 'combo';
export type SubDayState = 'upcoming' | 'ordered' | 'delivered' | 'skipped' | 'paused' | 'cancelled' | 'missed';
export type SubscriptionStatus = 'pending_payment' | 'active' | 'paused' | 'cancelled' | 'completed';

export interface SubDay {
  date: ISODate;
  meal: MealType;
  state: SubDayState;
  orderId?: ID;
}

export interface Subscription {
  id: ID;
  userId: ID;
  customerName: string;
  plan: PlanLength;
  meal: PlanMeal;
  /** Price per service day (combo counts lunch + dinner as one day). */
  pricePerDay: number;
  serviceDays: number;
  amount: number;
  startDate: ISODate;
  /** Preferred pickup slot per meal. */
  slots: Partial<Record<MealType, string>>;
  days: SubDay[];
  status: SubscriptionStatus;
  paymentId: ID | null;
  createdAt: Millis;
  pausedAt?: Millis;
  cancelledAt?: Millis;
  /** Total value credited back to wallet from skips / cancellation. */
  creditedBack: number;
}

export type WalletTxnType = 'topup' | 'payment' | 'refund' | 'rollover';

export interface WalletTxn {
  id: ID;
  userId: ID;
  type: WalletTxnType;
  /** Positive for credit, negative for debit. */
  amount: number;
  balanceAfter: number;
  note: string;
  ref?: ID;
  createdAt: Millis;
}

export type FreshnessTag = 'Farm fresh today' | 'Bought this morning' | 'Seasonal pick' | 'Locally sourced';

export interface KitchenUpdate {
  id: ID;
  date: ISODate;
  createdAt: Millis;
  /** data: URL (uploaded photo or generated illustration). */
  photo: string;
  note: string;
  oilUsed: string;
  vegetables: string[];
  freshness: FreshnessTag;
  author: string;
  heartedBy: ID[];
}

export interface Review {
  id: ID;
  orderId: ID;
  userId: ID;
  userName: string;
  mealType: MealType;
  stars: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: Millis;
}

export interface AppNotification {
  id: ID;
  /** User id, or "admin" for kitchen-side notifications. */
  audience: ID;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: Millis;
}

export interface Coupon {
  code: string;
  description: string;
  amountOff: number;
  minOrder: number;
  firstOrderOnly: boolean;
  active: boolean;
}

export interface MealWindow {
  /** Days relative to service date (-1 = night before). */
  cutoffDayOffset: number;
  cutoffTime: string; // "21:00"
  slotStart: string; // "07:30"
  slotEnd: string; // "10:00"
  slotCapacity: number;
  dailyCapacity: number;
}

export interface KitchenSettings {
  windows: Record<MealType, MealWindow>;
  /** Prepaid price per service day for each plan. */
  planPrices: Record<PlanLength, Record<PlanMeal, number>>;
  cookName: string;
  kitchenAddress: string;
  fssaiNumber: string;
  adminPin: string;
}
