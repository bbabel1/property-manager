import { NextResponse } from 'next/server';

import { listUnpaidBillsForCheckPayment } from '@/server/bills/pay-bills-by-check';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const propertiesParam = searchParams.get('properties') || '';
  const unitsParam = searchParams.get('units') || '';
  const vendorsParam = searchParams.get('vendors') || '';

  const toList = (value: string) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

  const properties = toList(propertiesParam);
  const units = toList(unitsParam);
  const vendors = toList(vendorsParam);

  const bills = await listUnpaidBillsForCheckPayment({
    propertyIds: properties.length ? properties : null,
    unitIds: units.length ? units : null,
    vendorIds: vendors.length ? vendors : null,
  });

  return NextResponse.json({ data: bills });
}

