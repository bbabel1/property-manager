'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function UIKitPage() {
  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold">UI Kit</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Design system components and tokens for the Property Manager application.
        </p>
      </div>

      <Tabs defaultValue="components" className="space-y-6">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-8">
          {/* Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Button variants and sizes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Button>Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Sizes</h4>
                <div className="flex items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">States</h4>
                <div className="flex gap-3">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Form input components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Input</label>
                  <Input placeholder="Enter text..." />
                  <p className="text-sm text-muted-foreground">This is a helper text</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Error State</label>
                  <Input placeholder="Enter text..." className="border-destructive" />
                  <p className="text-sm text-destructive">This field is required</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Success State</label>
                  <Input placeholder="Enter text..." className="border-green-500" />
                  <p className="text-sm text-green-600">Looks good!</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Disabled</label>
                  <Input placeholder="Disabled input" disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
              <CardDescription>Status and category indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Variants</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Warning</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge className="bg-transparent text-foreground hover:bg-accent">Ghost</Badge>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Sizes</h4>
                <div className="flex items-center gap-3">
                  <Badge className="text-xs px-1.5 py-0.5">Small</Badge>
                  <Badge>Default</Badge>
                  <Badge className="text-sm px-3 py-1">Large</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-8">
          {/* KPI Cards */}
          <Card>
            <CardHeader>
              <CardTitle>KPI Cards</CardTitle>
              <CardDescription>Standard metrics display pattern</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 bg-primary rounded" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold">24</p>
                    <p className="text-sm text-muted-foreground">+2 from last month</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 bg-green-500 rounded" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold">94%</p>
                    <p className="text-sm text-muted-foreground">Above target</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 bg-orange-500 rounded" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                      </div>
                    </div>
                    <p className="text-3xl font-bold">$45,230</p>
                    <p className="text-sm text-muted-foreground">+8% from last month</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
