import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Application Settings</h2>
        <p className="text-gray-600">This page will contain the application settings and configuration interface.</p>
      </div>
    </div>
  )
}
