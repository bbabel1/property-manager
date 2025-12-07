/**
 * Monthly Statement HTML Template (Modern)
 *
 * Implements the provided structure for the modern layout PDF.
 */

import React from 'react';
import { addMonths, format, subDays } from 'date-fns';

export interface StatementData {
  // Monthly Log Info
  monthlyLogId: string;
  periodStart: string;
  generatedAt: string;

  // Property & Unit Info
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  unit: {
    unitNumber: string;
    unitName: string | null;
  };

  // Tenant Info (if available)
  tenant: {
    name: string;
  } | null;

  propertyOwners?: string[] | null;

  // Financial Summary
  financialSummary: {
    totalCharges: number;
    totalCredits: number;
    totalPayments: number;
    totalBills: number;
    escrowAmount: number;
    managementFees: number;
    ownerDraw: number;
    netToOwner: number;
    balance: number;
    previousLeaseBalance?: number;
  };
  accountTotals?: Array<{
    label: string;
    balance: number;
  }>;

  // Categorized transaction items by GL account type
  incomeItems?: Array<{
    label: string;
    amount: number;
    date: string;
  }>;
  expenseItems?: Array<{
    label: string;
    amount: number;
    date: string;
  }>;
  escrowItems?: Array<{
    label: string;
    amount: number;
    date: string;
  }>;

  // Transaction Details (retained for compatibility though unused in this layout)
  charges: Array<{
    date: string;
    description: string;
    amount: number;
  }>;
  payments: Array<{
    date: string;
    description: string;
    amount: number;
    paymentMethod?: string;
  }>;
  bills: Array<{
    date: string;
    description: string;
    vendor?: string;
    amount: number;
  }>;
  escrowMovements: Array<{
    date: string;
    description: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
  }>;

  // Company Info (for letterhead)
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string; // URL or base64
  };
}

interface MonthlyStatementTemplateProps {
  data: StatementData;
}

export default function MonthlyStatementTemplate({ data }: MonthlyStatementTemplateProps) {
  // Inline statement logo sized to match provided reference (blue "Ora" + black "Property Management")
  const statementLogoSvg = `
    <svg width="600" height="140" viewBox="0 0 600 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .ora-word {
            fill: #1d57c4;
            stroke: #18499d;
            stroke-width: 2.2;
            font-family: 'Georgia', 'Times New Roman', serif;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .descriptor {
            fill: #111111;
            font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
            font-weight: 500;
          }
        </style>
      </defs>
      <text x="0" y="100" class="ora-word" font-size="96">Ora</text>
      <text x="210" y="88" class="descriptor" font-size="26">Property Management</text>
    </svg>
  `;
  const statementLogo = `data:image/svg+xml;utf8,${encodeURIComponent(statementLogoSvg)}`;
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatCurrency = (amount?: number | null) => {
    const safeAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    const formatted = currencyFormatter.format(Math.abs(safeAmount));
    const isNegative = safeAmount < 0 || Object.is(safeAmount, -0);
    return isNegative ? `-${formatted}` : formatted;
  };

  const formatDateSafe = (value: string, pattern: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return format(date, pattern);
  };

  const statementDate = formatDateSafe(data.generatedAt, 'MM/dd/yyyy') || '—';
  const periodStartDate = new Date(data.periodStart);
  const hasValidPeriod = !Number.isNaN(periodStartDate.getTime());
  const periodEndDate = hasValidPeriod
    ? subDays(addMonths(periodStartDate, 1), 1)
    : null;
  const periodRangeLabel =
    hasValidPeriod && periodEndDate
      ? `${format(periodStartDate, 'MM/dd/yyyy')} - ${format(periodEndDate, 'MM/dd/yyyy')}`
      : '—';

  const propertyStreetLine = [data.property.address, data.unit.unitNumber && `#${data.unit.unitNumber}`]
    .filter(Boolean)
    .join(', ');
  const cityStateZip = `${data.property.city}, ${data.property.state} ${data.property.zipCode}`;

  // Build structured summary rows with Income/Expenses grouping
  const incomeItems =
    data.incomeItems && data.incomeItems.length > 0
      ? data.incomeItems
      : [{ label: 'Rent Income', amount: data.financialSummary.totalPayments, date: '' }];

  const expenseItems =
    data.expenseItems && data.expenseItems.length > 0
      ? data.expenseItems
      : [
          { label: 'Bills Paid', amount: -Math.abs(data.financialSummary.totalBills), date: '' },
          { label: 'Management Fee', amount: -Math.abs(data.financialSummary.managementFees), date: '' },
        ];

  const escrowItems =
    data.escrowItems && data.escrowItems.length > 0
      ? data.escrowItems
      : [{ label: 'Property Tax Escrow', amount: 0, date: '' }];

  const totalIncome = incomeItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const totalExpenses = expenseItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const totalEscrow = escrowItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const ownerDrawAmount = Number(data.financialSummary.ownerDraw ?? 0);
  const endingBalanceRaw = totalIncome + totalExpenses + totalEscrow - Math.abs(ownerDrawAmount);
  const endingBalance = Object.is(endingBalanceRaw, -0) ? 0 : endingBalanceRaw;
  const totalEscrowDisplay = Object.is(totalEscrow, -0) ? 0 : totalEscrow;

  const accountTotals =
    data.accountTotals && data.accountTotals.length > 0
      ? data.accountTotals
      : [
          { label: 'Reserve', balance: 0 },
          { label: 'Property Tax Escrow', balance: 0 },
          { label: 'Tenant Security Deposit', balance: 0 },
        ];

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{`Monthly Statement - ${hasValidPeriod ? format(periodStartDate, 'MMMM yyyy') : ''}`}</title>
        <style>{`
          @page { size: letter; margin: 0.65in 0.75in; }
          
          body {
            margin: 42px 58px;
            font-family: "Times New Roman", Georgia, serif;
            color: #111;
            font-size: 12px;
            line-height: 1.5;
          }
          
          .statement-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          
          .logo-block img {
            height: 58px;
            max-width: 240px;
            width: auto;
            object-fit: contain;
            display: block;
          }
          
          .info-block {
            text-align: right;
            font-size: 12px;
            line-height: 1.4;
          }
          
          .info-block .label {
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            font-size: 11px;
          }
          
          .info-block .value {
            margin-top: 4px;
          }
          
          .divider {
            margin: 18px 0 14px;
            border: 0;
            border-top: 1px solid #b5b5b5;
          }
          
          .statement-period {
            text-align: center;
            margin: 10px 0 26px;
          }
          
          .statement-period .label {
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            font-size: 11px;
          }
          
          .statement-period .dates {
            margin-top: 6px;
            font-size: 13px;
            font-weight: 700;
          }
          
          .table-wrapper {
            page-break-inside: avoid;
            margin-bottom: 18px;
          }
          
          .summary-table,
          .holdings-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          
          .summary-table thead th,
          .holdings-table thead th {
            background: #f2f2f2;
            padding: 8px 10px;
            text-align: left;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.02em;
            border: 1px solid #e0e0e0;
            font-size: 11px;
          }
          
          .summary-table tbody td,
          .holdings-table tbody td {
            padding: 7px 10px;
            line-height: 1.35;
          }
          
          .summary-table tbody td.amount,
          .holdings-table tbody td.amount {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }
          
          .summary-table .section-row td {
            font-weight: 700;
            padding: 7px 10px;
          }
          
          .summary-table .item-row td {
            border-bottom: 1px dotted #bfbfbf;
          }
          
          .summary-table .item-row td:first-child {
            padding-left: 16px;
          }
          
          .summary-table .total-row td {
            font-weight: 700;
            padding: 7px 10px;
          }
          
          .summary-table .ending-row td {
            padding: 8px 10px;
            border-top: 1px dotted #bfbfbf;
            border-bottom: none;
            font-weight: 700;
          }
          
          .top-border-row td {
            border-top: 1px dotted #bfbfbf;
            border-bottom: none;
            font-weight: 700;
            padding: 7px 10px;
          }
          
          .no-border td {
            border-bottom: none !important;
          }

          .summary-title {
            text-align: left;
          }
          
          .holdings-table {
            margin-top: 26px;
          }
          
          .holdings-table thead th {
            font-size: 11px;
          }
          
          .holdings-table thead th + th {
            border-left: 1px solid #d0d0d0;
          }
          
          .holdings-table thead th:last-child {
            text-align: right;
            font-size: 11px;
          }
          
          .holdings-table tbody td {
            border-bottom: 1px dotted #bfbfbf;
          }
          
          .holdings-table tbody tr:last-child td {
            border-bottom: none;
          }
        `}</style>
      </head>
      <body>
        <div className="statement-header">
          <div className="logo-block">
            {statementLogo && <img src={statementLogo} alt="Ora Statement Logo" />}
          </div>
          <div className="info-block">
            <div>
              <div className="label">STATEMENT DATE</div>
              <div className="value">{statementDate}</div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div className="label">PROPERTY</div>
              <div className="value">
                {propertyStreetLine}
                <br />
                {cityStateZip}
              </div>
            </div>
          </div>
        </div>

        <hr className="divider" />

        <div className="statement-period">
          <div className="label">STATEMENT PERIOD</div>
          <div className="dates">{periodRangeLabel}</div>
        </div>

        <div className="table-wrapper">
          <table className="summary-table">
            <thead>
              <tr>
                <th colSpan={2} className="summary-title">Financial Summary</th>
              </tr>
            </thead>
            <tbody>
              <tr className="section-row">
                <td>Income</td>
                <td className="amount"></td>
              </tr>
              {incomeItems.map((item, idx) => (
                <tr key={`income-${idx}`} className="item-row">
                  <td>{item.label}</td>
                  <td className="amount">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              <tr className="total-row top-border-row">
                <td>Total Income</td>
                <td className="amount">{formatCurrency(totalIncome)}</td>
              </tr>

              <tr className="section-row">
                <td>Expenses</td>
                <td className="amount"></td>
              </tr>
              {expenseItems.map((item, idx) => (
                <tr key={`expense-${idx}`} className={`item-row ${idx === 0 ? 'no-border' : ''}`}>
                  <td>{item.label}</td>
                  <td className="amount">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              <tr className="total-row top-border-row">
                <td>Total Expenses</td>
                <td className="amount">{formatCurrency(totalExpenses)}</td>
              </tr>

              <tr className="section-row">
                <td>Escrow</td>
                <td className="amount"></td>
              </tr>
              {escrowItems.map((item, idx) => (
                <tr key={`escrow-${idx}`} className="item-row">
                  <td>{item.label}</td>
                  <td className="amount">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              <tr className="total-row top-border-row">
                <td>Total Escrow</td>
                <td className="amount">{formatCurrency(totalEscrowDisplay)}</td>
              </tr>

              <tr className="top-border-row">
                <td>Owner Draw</td>
                <td className="amount">{formatCurrency(ownerDrawAmount)}</td>
              </tr>

              <tr className="ending-row">
                <td>Ending Balance</td>
                <td className="amount">{formatCurrency(endingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="table-wrapper">
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Holdings</th>
                <th>As of {statementDate}</th>
              </tr>
            </thead>
            <tbody>
              {accountTotals.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td className="amount">{formatCurrency(item.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  );
}

