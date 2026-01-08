import { listUnpaidBillsForCheckPayment } from '@/server/bills/pay-bills-by-check';

async function main() {
  const bills = await listUnpaidBillsForCheckPayment({
    propertyIds: null,
    unitIds: null,
    vendorIds: null,
    statuses: null,
  });

  console.log(
    JSON.stringify(
      bills.map((b) => ({
        id: b.id,
        status: b.status,
        total: b.total_amount,
        remaining: b.remaining_amount,
        vendor: b.vendor_name,
        propertyId: b.property_id,
        propertyName: b.property_name,
      })),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
