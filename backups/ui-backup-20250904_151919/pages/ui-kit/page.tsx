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

      <Tabs defaultValue="tokens" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tokens">Design Tokens</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens" className="space-y-8">
          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
              <CardDescription>Brand and semantic color palette</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Brand Colors</h4>
                <div className="grid grid-cols-6 gap-3">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                    <div key={shade} className="text-center">
                      <div 
                        className={`w-full h-16 rounded-lg mb-2 border`}
                        style={{ backgroundColor: `var(--color-brand-${shade})` }}
                      />
                      <p className="text-xs font-mono">brand-{shade}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Semantic Colors</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="w-full h-16 bg-primary rounded-lg mb-2" />
                    <p className="text-xs font-mono">primary</p>
                  </div>
                  <div className="text-center">
                    <div className="w-full h-16 bg-success rounded-lg mb-2" />
                    <p className="text-xs font-mono">success</p>
                  </div>
                  <div className="text-center">
                    <div className="w-full h-16 bg-warning rounded-lg mb-2" />
                    <p className="text-xs font-mono">warning</p>
                  </div>
                  <div className="text-center">
                    <div className="w-full h-16 bg-destructive rounded-lg mb-2" />
                    <p className="text-xs font-mono">destructive</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Font scale and text styles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h1>Heading 1 - 4xl</h1>
                <h2>Heading 2 - 3xl</h2>
                <h3>Heading 3 - 2xl</h3>
                <h4>Heading 4 - xl</h4>
                <h5>Heading 5 - lg</h5>
                <h6>Heading 6 - base</h6>
                <p>Body text - base</p>
                <p className="text-sm">Small text - sm</p>
                <p className="text-xs">Extra small text - xs</p>
              </div>
            </CardContent>
          </Card>

          {/* Spacing */}
          <Card>
            <CardHeader>
              <CardTitle>Spacing</CardTitle>
              <CardDescription>Consistent spacing scale</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((space) => (
                  <div key={space} className="flex items-center gap-4">
                    <div 
                      className="bg-primary h-4"
                      style={{ width: `var(--space-${space})` }}
                    />
                    <span className="text-sm font-mono">space-{space}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                <Input 
                  label="Default Input"
                  placeholder="Enter text..."
                  description="This is a helper text"
                />
                <Input 
                  label="Error State"
                  placeholder="Enter text..."
                  error="This field is required"
                />
                <Input 
                  label="Success State"
                  placeholder="Enter text..."
                  state="success"
                  description="Looks good!"
                />
                <Input 
                  label="Disabled"
                  placeholder="Disabled input"
                  disabled
                />
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
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="ghost">Ghost</Badge>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Sizes</h4>
                <div className="flex items-center gap-3">
                  <Badge size="sm">Small</Badge>
                  <Badge>Default</Badge>
                  <Badge size="lg">Large</Badge>
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
                      <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                        <div className="w-5 h-5 bg-brand-500 rounded" />
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
