'use client';

import { Fragment } from 'react';

import { SelectGroup, SelectItem, SelectLabel } from '@/components/ui/select';
import { groupGlAccounts, type GlAccountLike } from '@/lib/gl-accounts/grouping';

export default function GlAccountSelectItems(props: { accounts: GlAccountLike[] }) {
  const groups = groupGlAccounts(props.accounts);

  if (groups.length === 0) {
    return (
      <SelectItem disabled value="__no_gl_accounts__">
        No GL accounts available
      </SelectItem>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <Fragment key={g.type}>
          <SelectGroup>
            <SelectLabel>{g.label}</SelectLabel>
            {g.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </Fragment>
      ))}
    </>
  );
}


