import React from 'react'

export default function DataTable({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">{head}</thead>
        <tbody className="bg-card divide-y divide-border">{children}</tbody>
      </table>
    </div>
  )
}

