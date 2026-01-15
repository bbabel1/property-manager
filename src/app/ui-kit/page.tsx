'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Body, Heading, Label } from '@/ui/typography'

export default function UIKitPage() {
  return (
    <div className="container py-8 space-y-8">
      <div>
        <Heading as="h1" size="h1" className="font-semibold">
          UI Kit
        </Heading>
        <Body size="lg" tone="muted" className="mt-2">
          Design system components and tokens for the Property Manager application.
        </Body>
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
              <CardTitle>
                <Heading as="h2" size="h4">
                  Buttons
                </Heading>
              </CardTitle>
              <CardDescription>
                <Body as="p" size="sm" tone="muted">
                  Button variants and sizes
                </Body>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Heading as="h3" size="h5" className="mb-3">
                  Variants
                </Heading>
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
                <Heading as="h3" size="h5" className="mb-3">
                  Sizes
                </Heading>
                <div className="flex items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              <div>
                <Heading as="h3" size="h5" className="mb-3">
                  States
                </Heading>
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
              <CardTitle>
                <Heading as="h2" size="h4">
                  Inputs
                </Heading>
              </CardTitle>
              <CardDescription>
                <Body as="p" size="sm" tone="muted">
                  Form input components
                </Body>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Input</Label>
                  <Input placeholder="Enter text..." />
                  <Body as="p" size="sm" tone="muted">
                    This is a helper text
                  </Body>
                </div>
                <div className="space-y-2">
                  <Label>Error State</Label>
                  <Input placeholder="Enter text..." className="border-destructive" />
                  <Body as="p" size="sm" className="text-destructive">
                    This field is required
                  </Body>
                </div>
                <div className="space-y-2">
                  <Label>Success State</Label>
                  <Input placeholder="Enter text..." className="border-green-500" />
                  <Body as="p" size="sm" className="text-green-600">
                    Looks good!
                  </Body>
                </div>
                <div className="space-y-2">
                  <Label>Disabled</Label>
                  <Input placeholder="Disabled input" disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Heading as="h2" size="h4">
                  Badges
                </Heading>
              </CardTitle>
              <CardDescription>
                <Body as="p" size="sm" tone="muted">
                  Status and category indicators
                </Body>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Heading as="h3" size="h5" className="mb-3">
                  Variants
                </Heading>
                <div className="flex flex-wrap gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="danger">Danger</Badge>
                  <Badge variant="info">Info</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge className="bg-transparent text-foreground hover:bg-accent">Ghost</Badge>
                </div>
              </div>
              
              <div>
                <Heading as="h3" size="h5" className="mb-3">
                  Sizes
                </Heading>
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
              <CardTitle>
                <Heading as="h2" size="h4">
                  KPI Cards
                </Heading>
              </CardTitle>
              <CardDescription>
                <Body as="p" size="sm" tone="muted">
                  Standard metrics display pattern
                </Body>
              </CardDescription>
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
                        <Body as="p" size="sm" tone="muted" className="font-medium leading-tight">
                          Total Properties
                        </Body>
                      </div>
                    </div>
                    <Heading as="p" size="h1" className="font-bold">
                      24
                    </Heading>
                    <Body as="p" size="sm" tone="muted">
                      +2 from last month
                    </Body>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 bg-green-500 rounded" />
                      </div>
                      <div>
                        <Body as="p" size="sm" tone="muted" className="font-medium leading-tight">
                          Occupancy Rate
                        </Body>
                      </div>
                    </div>
                    <Heading as="p" size="h1" className="font-bold">
                      94%
                    </Heading>
                    <Body as="p" size="sm" tone="muted">
                      Above target
                    </Body>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 bg-orange-500 rounded" />
                      </div>
                      <div>
                        <Body as="p" size="sm" tone="muted" className="font-medium leading-tight">
                          Monthly Revenue
                        </Body>
                      </div>
                    </div>
                    <Heading as="p" size="h1" className="font-bold">
                      $45,230
                    </Heading>
                    <Body as="p" size="sm" tone="muted">
                      +8% from last month
                    </Body>
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
