alter table public.properties
  add column bill_pay_list text,
  add column bill_pay_notes text;

comment on column public.properties.bill_pay_list is 'Free-form list of bills to be paid when Bill Pay service is active.';

comment on column public.properties.bill_pay_notes is 'Additional notes for handling Bill Pay service at the property level.';

alter table public.units
  add column bill_pay_list text,
  add column bill_pay_notes text;

comment on column public.units.bill_pay_list is 'Free-form list of bills to be paid when Bill Pay service is active for the unit.';

comment on column public.units.bill_pay_notes is 'Additional notes for Bill Pay service at the unit level.';
