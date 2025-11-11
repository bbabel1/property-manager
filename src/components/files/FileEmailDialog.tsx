'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2 } from 'lucide-react';

interface FileEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  fileName?: string;
}

export default function FileEmailDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
}: FileEmailDialogProps) {
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!fileId || !recipients.trim()) {
      setError('Recipients are required');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // TODO: Implement email API endpoint
      // For now, this is a placeholder
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Close dialog and reset form
      onOpenChange(false);
      setRecipients('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email File
          </DialogTitle>
          <DialogDescription>
            Send {fileName || 'this file'} via email to recipients
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipients">
              Recipients <span className="text-destructive">*</span>
            </Label>
            <Input
              id="recipients"
              type="email"
              placeholder="email@example.com, another@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              multiple
            />
            <p className="text-muted-foreground text-xs">
              Separate multiple email addresses with commas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder={`File: ${fileName || 'document'}`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Optional message to include with the file..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSending || !recipients.trim()}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
