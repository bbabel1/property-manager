/**
 * Monthly Statement HTML Template
 *
 * Professional HTML template for PDF generation.
 * Designed to be printed/rendered to PDF with proper styling.
 */

import React from 'react';
import { format } from 'date-fns';

interface StatementData {
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

  // Transaction Details
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const periodMonth = format(new Date(data.periodStart), 'MMMM yyyy');

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Monthly Statement - {periodMonth}</title>
        <style>{`
          @page {
            size: letter;
            margin: 0.5in;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: ${typography.body};
            font-size: 11pt;
            line-height: 1.5;
            color: ${palette.textPrimary};
            background: ${palette.surfaceDefault};
          }

          .container {
            max-width: 7.5in;
            margin: 0 auto;
          }

          .header {
            border-bottom: 3px solid ${palette.primaryStrong};
            padding-bottom: ${spacing.md};
            margin-bottom: ${spacing.xl};
          }

          .company-info {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }

          .company-logo {
            max-width: 200px;
            max-height: 80px;
          }

          .company-details {
            text-align: right;
            font-size: 9pt;
            color: ${palette.textMuted};
          }

          .statement-title {
            font-family: ${typography.heading};
            font-size: 24pt;
            font-weight: bold;
            color: ${palette.primaryStrong};
            margin: ${spacing.md} 0;
          }

          .property-info {
            background: ${palette.surfaceMuted};
            border: 1px solid ${palette.borderStrong};
            border-radius: 8px;
            padding: ${spacing.md};
            margin-bottom: ${spacing.xl};
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: ${spacing.md};
          }

          .info-item {
            margin-bottom: ${spacing.xs};
          }

          .info-label {
            font-size: 9pt;
            color: ${palette.textMuted};
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .info-value {
            font-size: 11pt;
            font-weight: 600;
            color: ${palette.textPrimary};
          }

          .section {
            margin-bottom: ${spacing.xl};
          }

          .section-title {
            font-size: 14pt;
            font-weight: bold;
            color: ${palette.primaryStrong};
            border-bottom: 2px solid ${palette.borderStrong};
            padding-bottom: 0.5rem;
            margin-bottom: 1rem;
          }

          .financial-summary {
            background: ${palette.surfaceHighlight};
            border: 2px solid ${palette.primary};
            border-radius: 8px;
            padding: ${spacing.lg};
            margin-bottom: ${spacing.xl};
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid ${palette.borderAccent};
          }

          .summary-row:last-child {
            border-bottom: none;
          }

          .summary-label {
            font-size: 11pt;
            color: ${palette.infoText};
          }

          .summary-value {
            font-size: 11pt;
            font-weight: 600;
            color: ${palette.textPrimary};
          }

          .summary-total {
            margin-top: ${spacing.md};
            padding-top: ${spacing.md};
            border-top: 2px solid ${palette.primary};
          }

          .summary-total .summary-label {
            font-size: 13pt;
            font-weight: bold;
          }

          .summary-total .summary-value {
            font-size: 16pt;
            font-weight: bold;
            color: ${palette.primaryStrong};
          }

          .transaction-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: ${spacing.md};
          }

          .transaction-table th {
            background: ${palette.surfacePanel};
            padding: 0.75rem;
            text-align: left;
            font-size: 9pt;
            font-weight: 600;
            color: ${palette.infoText};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid ${palette.borderStrong};
          }

          .transaction-table td {
            padding: 0.75rem;
            border-bottom: 1px solid ${palette.borderStrong};
            font-size: 10pt;
            color: ${palette.textPrimary};
          }

          .transaction-table tr:last-child td {
            border-bottom: none;
          }

          .amount-positive {
            color: ${palette.success};
            font-weight: 600;
          }

          .amount-negative {
            color: ${palette.danger};
            font-weight: 600;
          }

          .text-right {
            text-align: right;
          }

          .footer {
            margin-top: ${spacing.xxxl};
            padding-top: ${spacing.md};
            border-top: 1px solid ${palette.borderStrong};
            font-size: 9pt;
            color: ${palette.textMuted};
            text-align: center;
          }

          .page-break {
            page-break-after: always;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          {/* Header */}
          <div className="header">
            <div className="company-info">
              <div>
                {data.company.logo && (
                  <img src={data.company.logo} alt={data.company.name} className="company-logo" />
                )}
                <h1 className="statement-title">Monthly Statement</h1>
              </div>
              <div className="company-details">
                <div>{data.company.name}</div>
                {data.company.address && <div>{data.company.address}</div>}
                {data.company.phone && <div>{data.company.phone}</div>}
                {data.company.email && <div>{data.company.email}</div>}
              </div>
            </div>
          </div>

          {/* Property & Period Info */}
          <div className="property-info">
            <div className="info-grid">
              <div>
                <div className="info-item">
                  <div className="info-label">Statement Period</div>
                  <div className="info-value">{periodMonth}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Property</div>
                  <div className="info-value">{data.property.name}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Address</div>
                  <div className="info-value">
                    {data.property.address}
                    <br />
                    {data.property.city}, {data.property.state} {data.property.zipCode}
                  </div>
                </div>
              </div>
              <div>
                <div className="info-item">
                  <div className="info-label">Unit</div>
                  <div className="info-value">
                    {data.unit.unitNumber}
                    {data.unit.unitName && ` - ${data.unit.unitName}`}
                  </div>
                </div>
                {data.tenant && (
                  <div className="info-item">
                    <div className="info-label">Tenant</div>
                    <div className="info-value">{data.tenant.name}</div>
                  </div>
                )}
                <div className="info-item">
                  <div className="info-label">Generated</div>
                  <div className="info-value">{formatDate(data.generatedAt)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="financial-summary">
            <div className="section-title" style={{ borderBottom: 'none', marginBottom: '1rem' }}>
              Financial Summary
            </div>
            {data.financialSummary.previousLeaseBalance !== undefined && (
              <div className="summary-row">
                <span className="summary-label">Previous Month Balance</span>
                <span className="summary-value">
                  {formatCurrency(data.financialSummary.previousLeaseBalance)}
                </span>
              </div>
            )}
            <div className="summary-row">
              <span className="summary-label">Total Charges</span>
              <span className="summary-value amount-positive">
                {formatCurrency(data.financialSummary.totalCharges)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Credits</span>
              <span className="summary-value amount-negative">
                -{formatCurrency(data.financialSummary.totalCredits)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Payments</span>
              <span className="summary-value amount-positive">
                {formatCurrency(data.financialSummary.totalPayments)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Total Bills</span>
              <span className="summary-value amount-negative">
                {formatCurrency(data.financialSummary.totalBills)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Escrow</span>
              <span className="summary-value">
                {formatCurrency(data.financialSummary.escrowAmount)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Management Fees</span>
              <span className="summary-value amount-negative">
                {formatCurrency(data.financialSummary.managementFees)}
              </span>
            </div>
            <div className="summary-row summary-total">
              <span className="summary-label">Net to Owner</span>
              <span className="summary-value">
                {formatCurrency(data.financialSummary.netToOwner)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Balance</span>
              <span
                className={`summary-value ${
                  data.financialSummary.balance >= 0 ? 'amount-positive' : 'amount-negative'
                }`}
              >
                {formatCurrency(data.financialSummary.balance)}
              </span>
            </div>
          </div>

          {/* Charges Detail */}
          {data.charges.length > 0 && (
            <div className="section">
              <div className="section-title">Charges</div>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charges.map((charge, index) => (
                    <tr key={index}>
                      <td>{formatDate(charge.date)}</td>
                      <td>{charge.description}</td>
                      <td className="amount-positive text-right">
                        {formatCurrency(charge.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payments Detail */}
          {data.payments.length > 0 && (
            <div className="section">
              <div className="section-title">Payments</div>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((payment, index) => (
                    <tr key={index}>
                      <td>{formatDate(payment.date)}</td>
                      <td>{payment.description}</td>
                      <td>{payment.paymentMethod || 'N/A'}</td>
                      <td className="amount-positive text-right">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bills Detail */}
          {data.bills.length > 0 && (
            <div className="section">
              <div className="section-title">Bills & Expenses</div>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bills.map((bill, index) => (
                    <tr key={index}>
                      <td>{formatDate(bill.date)}</td>
                      <td>{bill.description}</td>
                      <td>{bill.vendor || 'N/A'}</td>
                      <td className="amount-negative text-right">{formatCurrency(bill.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Escrow Movements */}
          {data.escrowMovements.length > 0 && (
            <div className="section">
              <div className="section-title">Escrow Movements</div>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.escrowMovements.map((movement, index) => (
                    <tr key={index}>
                      <td>{formatDate(movement.date)}</td>
                      <td>{movement.description}</td>
                      <td style={{ textTransform: 'capitalize' }}>{movement.type}</td>
                      <td
                        className={`text-right ${movement.type === 'deposit' ? 'amount-positive' : 'amount-negative'}`}
                      >
                        {movement.type === 'deposit' ? '+' : '-'}
                        {formatCurrency(movement.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            <p>
              This statement was generated on {formatDate(data.generatedAt)} and reflects all
              transactions for the period of {periodMonth}.
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              If you have any questions about this statement, please contact {data.company.name}.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
