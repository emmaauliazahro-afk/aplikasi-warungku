import { describe, it, expect } from 'vitest';
import {
  formatTransactionNumber,
  computeDebtFields,
  computeCashChange,
  applyStockAdjustment,
  calcProfit,
  computeTotal,
} from '../src/utils/calc';
import { ApiError } from '../src/middleware/error';

describe('formatTransactionNumber', () => {
  it('formats as TRX-YYYYMMDD-XXXX with zero-padded sequence', () => {
    const date = new Date(2026, 5, 11); // June 11 2026 (month is 0-based)
    expect(formatTransactionNumber(date, 1)).toBe('TRX-20260611-0001');
    expect(formatTransactionNumber(date, 42)).toBe('TRX-20260611-0042');
    expect(formatTransactionNumber(date, 1234)).toBe('TRX-20260611-1234');
  });

  it('zero-pads month and day', () => {
    const date = new Date(2026, 0, 5); // Jan 5
    expect(formatTransactionNumber(date, 7)).toBe('TRX-20260105-0007');
  });
});

describe('computeDebtFields', () => {
  it('returns UNPAID when nothing is paid', () => {
    expect(computeDebtFields(100000, 0)).toEqual({ remaining: 100000, status: 'UNPAID' });
  });

  it('returns PARTIAL when partially paid', () => {
    expect(computeDebtFields(100000, 30000)).toEqual({ remaining: 70000, status: 'PARTIAL' });
  });

  it('returns PAID when fully paid', () => {
    expect(computeDebtFields(100000, 100000)).toEqual({ remaining: 0, status: 'PAID' });
  });

  it('clamps remaining to 0 on overpayment and marks PAID', () => {
    expect(computeDebtFields(100000, 120000)).toEqual({ remaining: 0, status: 'PAID' });
  });
});

describe('computeCashChange', () => {
  it('returns change when paid exceeds total', () => {
    expect(computeCashChange(148000, 150000)).toBe(2000);
  });

  it('returns 0 on exact payment', () => {
    expect(computeCashChange(50000, 50000)).toBe(0);
  });

  it('throws when underpaid', () => {
    expect(() => computeCashChange(50000, 40000)).toThrow(ApiError);
    expect(() => computeCashChange(50000, 40000)).toThrow('Jumlah bayar kurang dari total');
  });
});

describe('applyStockAdjustment', () => {
  it('SET replaces the stock value', () => {
    expect(applyStockAdjustment(60, 'SET', 50)).toBe(50);
  });

  it('ADD increases the stock', () => {
    expect(applyStockAdjustment(60, 'ADD', 20)).toBe(80);
  });

  it('SUBTRACT decreases the stock', () => {
    expect(applyStockAdjustment(60, 'SUBTRACT', 10)).toBe(50);
  });

  it('allows reducing to exactly 0', () => {
    expect(applyStockAdjustment(60, 'SUBTRACT', 60)).toBe(0);
  });

  it('throws when result would be negative', () => {
    expect(() => applyStockAdjustment(60, 'SUBTRACT', 100)).toThrow(
      'Stok hasil penyesuaian tidak boleh negatif'
    );
  });
});

describe('calcProfit', () => {
  it('sums (price - costPrice) * quantity across items', () => {
    const items = [
      { price: 68000, costPrice: 60000, quantity: 2 }, // 16000
      { price: 5000, costPrice: 3000, quantity: 5 }, // 10000
    ];
    expect(calcProfit(items)).toBe(26000);
  });

  it('returns 0 for empty items', () => {
    expect(calcProfit([])).toBe(0);
  });
});

describe('computeTotal', () => {
  it('subtracts discount from subtotal', () => {
    expect(computeTotal(100000, 10000)).toBe(90000);
  });

  it('allows zero discount', () => {
    expect(computeTotal(100000, 0)).toBe(100000);
  });

  it('throws when discount exceeds subtotal', () => {
    expect(() => computeTotal(100000, 120000)).toThrow('Diskon tidak boleh melebihi subtotal');
  });
});
