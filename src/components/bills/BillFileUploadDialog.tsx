"use client"

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CheckCircle2 } from 'lucide-react'
import type { BillFileRecord } from './types'

type BillFileUploadDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: string
  uploaderName?: string | null
  onSaved?: (row: BillFileRecord) => void
}

export default function BillFileUploadDialog({
  open,
  onOpenChange,
  billId,
  uploaderName = 'Team member',
  onSaved
}: BillFileUploadDialogProps) {
  const [step, setStep] = useState<'select' | 'details'>('select')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const resetState = useCallback(() => {
    setStep('select')
    setSelectedFile(null)
    setTitle('')
    setError(null)
    setIsSaving(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const close = useCallback(() => {
    onOpenChange(false)
    resetState()
  }, [onOpenChange, resetState])

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('Invalid file data'))
          return
        }
        const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result
        resolve(base64)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

  const save = async () => {
    if (!selectedFile || isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      const base64 = await fileToBase64(selectedFile)
      if (!base64) throw new Error('Unable to read file contents')

      const trimmedTitle = title.trim() || selectedFile.name
      let fileName = trimmedTitle
      if (!fileName.includes('.') && selectedFile.name.includes('.')) {
        const ext = selectedFile.name.split('.').pop()
        if (ext) fileName = `${fileName}.${ext}`
      }

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'bill',
          entityId: billId,
          fileName,
          mimeType: selectedFile.type || undefined,
          base64,
          isPrivate: true
        })
      })

      if (!response.ok) {
        const details = await response.json().catch(() => ({}))
        const message = typeof details?.error === 'string' ? details.error : 'Failed to upload file'
        throw new Error(message)
      }

      const payload = await response.json().catch(() => ({}))
      const file = payload?.file ?? null
      const link = payload?.link ?? null
      const buildiumFileId =
        typeof payload?.buildiumFileId === 'number'
          ? payload.buildiumFileId
          : (typeof file?.buildium_file_id === 'number' ? file.buildium_file_id : null)
      const buildiumHref =
        typeof payload?.buildiumFile?.Href === 'string'
          ? payload.buildiumFile.Href
          : (typeof file?.buildium_href === 'string' ? file.buildium_href : null)

      const uploadedAt: string =
        typeof link?.added_at === 'string'
          ? link.added_at
          : typeof file?.created_at === 'string'
            ? file.created_at
            : new Date().toISOString()

      const uploadedBy =
        (typeof link?.added_by === 'string' && link.added_by.length ? link.added_by : null) ??
        uploaderName ??
        'Team member'

      const buildiumSyncError = typeof payload?.buildiumSyncError === 'string' && payload.buildiumSyncError.length
        ? payload.buildiumSyncError
        : null

      const record: BillFileRecord = {
        id:
          (file?.id as string) ||
          (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`),
        title: file?.file_name || fileName,
        uploadedAt,
        uploadedBy,
        buildiumFileId,
        buildiumHref,
        buildiumSyncError
      }

      onSaved?.(record)

      if (buildiumSyncError) {
        setError(`Saved locally. Buildium sync failed: ${buildiumSyncError}`)
        return
      }

      close()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl sm:max-w-4xl top-[35%] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload to this bill record.'
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
                <div className="col-span-12 px-4 py-2">Title</div>
              </div>
              <div className="grid grid-cols-12 items-center gap-3 border-t bg-background px-3 py-3">
                <div className="col-span-12 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <Input
                    id="bill-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    autoFocus
                  />
                </div>
              </div>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step === 'details' ? (
            <>
              <Button type="button" onClick={save} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" onClick={close} disabled={isSaving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
