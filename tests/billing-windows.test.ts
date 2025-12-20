import { describe, it, expect } from 'vitest';
import { generateBillingWindows } from '@/lib/billing-windows';

describe('billing windows', () => {
  it('monthly uses prior calendar month', () => {
    const date = new Date('2024-02-01T00:00:00Z');
    const windows = generateBillingWindows('monthly', date);
    expect(windows).toEqual([{ start: '2024-01-01', end: '2024-01-31' }]);
  });

  it('weekly includes Mon-Sun weeks whose Sunday in billed month', () => {
    const date = new Date('2024-03-01T00:00:00Z'); // bills Feb
    const windows = generateBillingWindows('weekly', date);
    expect(windows).toEqual([
      { start: '2024-01-29', end: '2024-02-04' },
      { start: '2024-02-05', end: '2024-02-11' },
      { start: '2024-02-12', end: '2024-02-18' },
      { start: '2024-02-19', end: '2024-02-25' },
    ]);
  });

  it('quarterly only runs on quarter boundaries', () => {
    const aprilRun = generateBillingWindows('quarterly', new Date('2024-04-01T00:00:00Z'));
    expect(aprilRun).toEqual([{ start: '2024-01-01', end: '2024-03-31' }]);
    const mayRun = generateBillingWindows('quarterly', new Date('2024-05-01T00:00:00Z'));
    expect(mayRun).toEqual([]);
  });

  it('annually only runs on Jan 1 covering prior year', () => {
    const janRun = generateBillingWindows('annually', new Date('2025-01-01T00:00:00Z'));
    expect(janRun).toEqual([{ start: '2024-01-01', end: '2024-12-31' }]);
    const febRun = generateBillingWindows('annually', new Date('2025-02-01T00:00:00Z'));
    expect(febRun).toEqual([]);
  });
});
