'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from './utils'

function NavTabsRoot({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="nav-tabs"
      className={cn('flex flex-col gap-6', className)}
      {...props}
    />
  )
}

function NavTabsHeader({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('border-b border-border', className)}>
      {children}
    </div>
  )
}

function NavTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="nav-tabs-list"
      className={cn(
        'flex items-center space-x-8 bg-transparent p-0',
        className,
      )}
      {...props}
    />
  )
}

function NavTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="nav-tabs-trigger"
      className={cn(
        'flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium text-foreground transition-colors',
        'data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-none',
        'hover:border-muted-foreground hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded-md focus-visible:bg-primary/5',
        'disabled:pointer-events-none disabled:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4',
        className,
      )}
      {...props}
    />
  )
}

function NavTabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot='nav-tabs-content'
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

const NavTabs = Object.assign(NavTabsRoot, {
  Header: NavTabsHeader,
  List: NavTabsList,
  Trigger: NavTabsTrigger,
  Content: NavTabsContent,
})

export {
  NavTabs,
  NavTabsRoot,
  NavTabsHeader,
  NavTabsList,
  NavTabsTrigger,
  NavTabsContent,
}
export default NavTabs
