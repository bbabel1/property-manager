"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { summarizeBuildiumResponse, describeBuildiumPayload } from "@/lib/buildium-response";

type BuildiumResponse = {
  success?: boolean;
  status?: number;
  payload?: unknown;
} | undefined;

export type BuildiumDeleteConfirmationDialogProps = {
  open: boolean;
  buildium: BuildiumResponse;
  expiresAt?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
};

export function BuildiumDeleteConfirmationDialog({
  open,
  buildium,
  expiresAt,
  onConfirm,
  onCancel,
  isConfirming,
}: BuildiumDeleteConfirmationDialogProps) {
  const summary = summarizeBuildiumResponse(buildium);
  const payloadPreview = formatPayload(buildium?.payload);
  const expiresLabel = expiresAt ? formatExpiration(expiresAt) : null;

  return (
    <AlertDialog open={open} onOpenChange={(next) => (next ? null : onCancel())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Buildium response</AlertDialogTitle>
          <AlertDialogDescription>
            Buildium acknowledged the bill update. Review the response below and confirm to remove the bill locally.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 px-4 py-3 text-sm">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
            <p className="text-foreground font-medium">{summary}</p>
          </div>
          {typeof buildium?.status === "number" ? (
            <p className="text-xs text-muted-foreground">HTTP status {buildium.status}</p>
          ) : null}
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Payload</p>
            <pre className="max-h-48 overflow-auto rounded bg-background/80 p-3 text-xs text-foreground">
              {payloadPreview}
            </pre>
          </div>
          {expiresLabel ? (
            <p className="text-xs text-muted-foreground">Confirmation expires {expiresLabel}.</p>
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isConfirming}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              if (!isConfirming) onConfirm();
            }}
            disabled={isConfirming}
          >
            {isConfirming ? "Deleting…" : "Delete bill"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function formatPayload(payload: unknown): string {
  if (payload === null || typeof payload === "undefined") return "No payload returned.";
  if (typeof payload === "string") return payload;
  const described = describeBuildiumPayload(payload);
  if (described && typeof payload !== "object") {
    return described;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function formatExpiration(expiresAt: string): string | null {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  return `on ${date.toLocaleString()}`;
}
