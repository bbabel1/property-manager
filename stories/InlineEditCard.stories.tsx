import type { Meta, StoryObj } from '@storybook/react'
import InlineEditCard from '@/components/form/InlineEditCard'
import { useState } from 'react'

const meta: Meta<typeof InlineEditCard> = {
  title: 'Form/InlineEditCard',
  component: InlineEditCard,
}

export default meta
type Story = StoryObj<typeof InlineEditCard>

export const Basic: Story = {
  render: () => {
    const Demo = () => {
      const [editing, setEditing] = useState(false)
      return (
        <InlineEditCard
          title="Demo Card"
          editing={editing}
          onEdit={()=> setEditing(true)}
          onCancel={()=> setEditing(false)}
          onSave={()=> setEditing(false)}
          view={<div>Read-only content…</div>}
          edit={<div>Editable form fields…</div>}
        />
      )
    }
    return <Demo />
  }
}

