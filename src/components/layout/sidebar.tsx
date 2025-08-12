'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building,
  Building2,
  Users,
  FileText,
  DollarSign,
  Wrench,
  Settings,
  Home,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Properties', href: '/properties', icon: Building },
  { name: 'Units', href: '/units', icon: Building2 },
  { name: 'Leases', href: '/leases', icon: FileText },
  { name: 'Owners', href: '/owners', icon: Users },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Lease Renewals', href: '/leases', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-gray-800">
      <div className="flex items-center h-16 px-6 border-b border-gray-700">
        <Building className="h-8 w-8 text-white" />
        <div className="ml-3">
          <h1 className="text-lg font-semibold text-white">Ora Property Management</h1>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-white">Need Help?</h3>
          <p className="text-xs text-gray-300 mt-1">
            Get support from our team
          </p>
          <button className="mt-2 w-full text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors">
            Get Support
          </button>
        </div>
      </div>
    </div>
  )
}
