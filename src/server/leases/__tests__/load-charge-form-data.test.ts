import { describe, expect, it } from 'vitest';

import { sanitizeChargePrefillParams } from '../load-charge-form-data';

const accounts = new Set(['a1', 'a2']);
const tenants = new Set(['t1', 't2']);

describe('sanitizeChargePrefillParams', () => {
  it('returns valid prefills when ids are allowed', () => {
    const result = sanitizeChargePrefillParams(
      {
        account: 'a1',
        tenant: 't2',
        amount: '123.45',
        memo: 'Test memo',
        date: '2024-01-02',
      },
      { accountIds: accounts, tenantIds: tenants },
    );
    expect(result).toEqual({
      accountId: 'a1',
      tenantId: 't2',
      amount: 123.45,
      memo: 'Test memo',
      date: '2024-01-02',
    });
  });

  it('drops invalid ids and bad values', () => {
    const result = sanitizeChargePrefillParams(
      {
        account: 'bad',
        tenant: 'nope',
        amount: '-10',
        memo: '',
        date: 'bad-date',
      },
      { accountIds: accounts, tenantIds: tenants },
    );
    expect(result).toEqual({
      accountId: null,
      tenantId: null,
      amount: null,
      memo: null,
      date: null,
    });
  });

  it('accepts ISO-like dates and trims memo', () => {
    const result = sanitizeChargePrefillParams(
      {
        account: 'a2',
        tenant: 't1',
        amount: '50',
        memo: '  spaced memo  ',
        date: '2024/03/04',
      },
      { accountIds: accounts, tenantIds: tenants },
    );
    expect(result.accountId).toBe('a2');
    expect(result.tenantId).toBe('t1');
    expect(result.amount).toBe(50);
    expect(result.memo).toBe('spaced memo');
    expect(result.date).toBe('2024-03-04');
  });

  it('ignores overly long memo', () => {
    const longMemo = 'x'.repeat(2100);
    const result = sanitizeChargePrefillParams(
      { memo: longMemo },
      { accountIds: accounts, tenantIds: tenants },
    );
    expect(result.memo).toBeNull();
  });
});
