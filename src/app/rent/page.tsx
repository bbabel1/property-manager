import { DollarSign } from 'lucide-react'

export default function RentPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rent Tracking</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
          <DollarSign className="h-4 w-4 mr-2" />
          Record Payment
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Rent Tracking</h2>
        <p className="text-gray-600">This page will contain the rent tracking and payment management interface.</p>
      </div>
    </div>
  )
}
