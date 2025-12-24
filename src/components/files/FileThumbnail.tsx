'use client';

import Image from 'next/image';
import { useState } from 'react';
import { FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface FileThumbnailProps {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function FileThumbnail({
  fileId,
  fileName,
  mimeType,
  className,
  size = 'sm',
}: FileThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  const sizePixels: Record<NonNullable<FileThumbnailProps['size']>, number> = {
    sm: 32,
    md: 48,
    lg: 64,
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const isImage = mimeType?.startsWith('image/');

  // Try to load image thumbnail if it's an image
  const loadThumbnail = async () => {
    if (!isImage || hasError) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/${fileId}/presign`);
      if (response.ok) {
        const data = await response.json();
        if (data?.getUrl) {
          setImageUrl(data.getUrl);
        }
      }
    } catch (error) {
      console.error('Error loading thumbnail:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isImage && imageUrl) {
    const dimension = sizePixels[size];
    return (
      <Image
        src={imageUrl}
        alt={fileName}
        width={dimension}
        height={dimension}
        unoptimized
        className={cn('rounded object-cover', sizeClasses[size], className)}
        onError={() => setHasError(true)}
      />
    );
  }

  if (isImage && !hasError && !imageUrl && !isLoading) {
    loadThumbnail();
  }

  return (
    <div
      className={cn(
        'bg-muted flex items-center justify-center rounded',
        sizeClasses[size],
        className,
      )}
      aria-label={`File type: ${mimeType || 'unknown'}`}
    >
      {isLoading ? (
        <Loader2 className={cn('text-muted-foreground animate-spin', iconSizeClasses[size])} />
      ) : isImage ? (
        <ImageIcon className={cn('text-blue-500', iconSizeClasses[size])} />
      ) : (
        <FileText className={cn('text-muted-foreground', iconSizeClasses[size])} />
      )}
    </div>
  );
}
