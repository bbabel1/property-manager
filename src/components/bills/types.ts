export type BillFileRecord = {
  id: string
  title: string
  uploadedAt: string
  uploadedBy: string | null
  buildiumFileId?: number | null
  buildiumHref?: string | null
  buildiumSyncError?: string | null
}
