"use client"

import { useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CheckCircle2 } from 'lucide-react'

export type PropertyFileRow = {
  id: string
  title: string
  category: string
  description: string | null
  uploadedAt: Date
  uploadedBy: string
}

export default function PropertyFileUploadDialog({
  open,
  onOpenChange,
  uploaderName = 'Team member',
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploaderName?: string | null
  onSaved?: (row: PropertyFileRow) => void
}) {
  const [step, setStep] = useState<'select' | 'details'>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Uncategorized')
  const [description, setDescription] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const resetState = useCallback(() => {
    setStep('select')
    setSelectedFile(null)
    setTitle('')
    setCategory('Uncategorized')
    setDescription('')
  }, [])

  const close = useCallback(() => {
    onOpenChange(false)
    resetState()
  }, [onOpenChange, resetState])

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return
    const file = fileList[0]
    setSelectedFile(file)
    setTitle(file.name)
    setStep('details')
  }

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files)
  }

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    handleFiles(event.dataTransfer.files)
  }

  const save = () => {
    if (!selectedFile) return
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
    const row: PropertyFileRow = {
      id,
      title: title.trim() || selectedFile.name,
      category: category.trim() || 'Uncategorized',
      description: description.trim() || null,
      uploadedAt: new Date(),
      uploadedBy: uploaderName || 'Team member',
    }
    onSaved?.(row)
    close()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl sm:max-w-4xl top-[35%] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload property file</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload to this property record.'
              : 'Review file details before saving.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4">
            <label
              onDrop={onDrop}
              onDragOver={(event) => event.preventDefault()}
              className="flex h-40 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted/40 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <div className="text-center">
                Drag &amp; drop files here or{' '}
                <span className="text-primary underline">Browse</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFileInputChange}
                accept="application/pdf,image/*"
              />
            </label>
            <div className="text-xs text-muted-foreground">
              Supported formats include PDF and common image types. Maximum size 25 MB.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border">
              <div className="grid grid-cols-12 bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <div className="col-span-4 px-4 py-2">Title</div>
                <div className="col-span-3 px-4 py-2">Category</div>
                <div className="col-span-5 px-4 py-2">Description</div>
              </div>
              <div className="grid grid-cols-12 items-center gap-3 border-t bg-background px-3 py-3">
                <div className="col-span-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <Input
                    id="property-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <select
                    id="property-file-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <option value="Uncategorized">Uncategorized</option>
                    <option value="Lease">Lease</option>
                    <option value="Statement">Statement</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-5">
                  <Input
                    id="property-file-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add an optional description"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step === 'details' ? (
            <>
              <Button type="button" onClick={save}>Save</Button>
              <Button type="button" variant="secondary" onClick={save}>Save and share</Button>
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

