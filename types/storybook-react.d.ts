declare module '@storybook/react' {
  import type { ReactNode, ComponentType } from 'react'

  export type Meta<T extends ComponentType<any>> = {
    title: string
    component?: T
    decorators?: Array<(story: () => ReactNode) => ReactNode>
    parameters?: Record<string, unknown>
    args?: Partial<Parameters<T>[0]>
    render?: () => ReactNode
  }

  export type StoryObj<T extends ComponentType<any>> = {
    args?: Partial<Parameters<T>[0]>
    render?: () => ReactNode
    name?: string
    parameters?: Record<string, unknown>
  }
}
