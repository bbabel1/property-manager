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
  { name: 'Rental Owners', href: '/owners', icon: Users },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Lease Renewals', href: '/leases', icon: FileText },
  { name: 'Rent Tracking', href: '/rent', icon: DollarSign },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <Building className="h-8 w-8 text-blue-600" />
        <div className="ml-3">
          <h1 className="text-lg font-semibold text-gray-900">PropertyManager</h1>
          <p className="text-xs text-gray-500">Professional Edition</p>
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
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900">Need Help?</h3>
          <p className="text-xs text-blue-700 mt-1">
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
