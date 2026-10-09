import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOWS, cutoffAt, isOrderable, nextCutoff, nextOrderableDate, slotAvailability, slotsFor } from '@/lib/cutoff';
import { istAt, istDate } from '@/lib/time';

const W = DEFAULT_WINDOWS;
// 2026-10-09 is a Friday; 2026-10-11 is a Sunday.
const FRI = '2026-10-09';
const SAT = '2026-10-10';
const SUN = '2026-10-11';
const MON = '2026-10-12';

describe('IST helpers', () => {
  it('formats dates in IST regardless of UTC day', () => {
    // 20:00 UTC on the 8th is 01:30 IST on the 9th.
    expect(istDate(Date.UTC(2026, 9, 8, 20, 0))).toBe(FRI);
    expect(istAt(FRI, '09:00')).toBe(Date.UTC(2026, 9, 9, 3, 30));
  });
});

describe('cutoffs', () => {
  it('breakfast closes at 9 PM the night before', () => {
    expect(cutoffAt('breakfast', SAT, W)).toBe(istAt(FRI, '21:00'));
  });
  it('lunch closes at 9 AM and dinner at 4 PM the same day', () => {
    expect(cutoffAt('lunch', FRI, W)).toBe(istAt(FRI, '09:00'));
    expect(cutoffAt('dinner', FRI, W)).toBe(istAt(FRI, '16:00'));
  });
  it('is open one minute before cutoff and closed exactly at cutoff', () => {
    expect(isOrderable('lunch', FRI, istAt(FRI, '08:59'), W)).toBe(true);
    expect(isOrderable('lunch', FRI, istAt(FRI, '09:00'), W)).toBe(false);
    expect(isOrderable('breakfast', SAT, istAt(FRI, '20:59'), W)).toBe(true);
    expect(isOrderable('breakfast', SAT, istAt(FRI, '21:00'), W)).toBe(false);
  });
  it('never allows Sunday (kitchen holiday)', () => {
    expect(isOrderable('lunch', SUN, istAt(FRI, '10:00'), W)).toBe(false);
  });
  it('rolls over to the next service day, skipping Sunday', () => {
    expect(nextOrderableDate('lunch', istAt(FRI, '08:00'), W)).toBe(FRI);
    expect(nextOrderableDate('lunch', istAt(FRI, '10:00'), W)).toBe(SAT);
    expect(nextOrderableDate('lunch', istAt(SAT, '10:00'), W)).toBe(MON);
    // Saturday 9 PM: Sunday breakfast doesn't exist, Monday's cutoff is Sunday 9 PM.
    expect(nextOrderableDate('breakfast', istAt(SAT, '21:30'), W)).toBe(MON);
  });
  it('picks the soonest open cutoff for the home countdown', () => {
    const nc = nextCutoff(istAt(FRI, '10:00'), W);
    expect(nc.meal).toBe('dinner');
    expect(nc.remainingMs).toBe(6 * 3_600_000);
  });
});

describe('pickup slots', () => {
  it('creates 30-minute slots inside the window', () => {
    const s = slotsFor('lunch', W);
    expect(s.map((x) => x.start)).toEqual(['12:30', '13:00', '13:30', '14:00']);
    expect(s[0].label).toBe('12:30 – 1:00 PM');
  });
  it('reports remaining capacity, full slots and past slots', () => {
    const slot = slotsFor('lunch', W)[0];
    const before = istAt(FRI, '08:00');
    expect(slotAvailability(slot, FRI, 7, before, W)).toEqual({ left: 3, open: true });
    expect(slotAvailability(slot, FRI, 10, before, W).open).toBe(false);
    expect(slotAvailability(slot, FRI, 0, istAt(FRI, '12:31'), W).reason).toBe('Time passed');
  });
});
