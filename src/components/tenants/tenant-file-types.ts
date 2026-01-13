export type TenantFileRow = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  uploadedAt: Date;
  uploadedBy: string;
  href?: string | null;
};

export type TenantFileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  uploaderName?: string | null;
  onSaved?: (row?: TenantFileRow) => void | Promise<void>;
};

export type TenantFilesPanelProps = {
  tenantId: string | null;
  buildiumTenantId: number | null;
  orgId: string | null;
  uploaderName?: string | null;
  initialFiles?: TenantFileRow[];
};
