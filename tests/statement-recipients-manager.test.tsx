import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';

import StatementRecipientsManager from '@/components/monthly-logs/StatementRecipientsManager';

type ConsoleMethod = 'warn' | 'error';

function spyOnConsole(method: ConsoleMethod) {
  const original = console[method];
  let calls = 0;

  console[method] = (...args: unknown[]) => {
    calls += 1;
    return original.apply(console, args as never);
  };

  return {
    get calls() {
      return calls;
    },
    restore() {
      console[method] = original;
    },
  };
}

test('StatementRecipientsManager renders without logging warnings or errors', async () => {
  const warnSpy = spyOnConsole('warn');
  const errorSpy = spyOnConsole('error');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({ ok: true, text: async () => '[]' } as unknown as Response);

  renderToString(<StatementRecipientsManager propertyId="test-property" />);

  assert.equal(warnSpy.calls, 0);
  assert.equal(errorSpy.calls, 0);

  globalThis.fetch = originalFetch;
  warnSpy.restore();
  errorSpy.restore();
});
