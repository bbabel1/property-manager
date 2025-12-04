'use client';

import type { ReactNode } from 'react';
import { SWRConfig } from 'swr';

import Providers from './providers';

type ClientProvidersProps = {
  children: ReactNode;
};

const swrFetcher = async (resource: RequestInfo, init?: RequestInit) => {
  let response: Response | null = null;
  let rawText: string = '';
  
  try {
    response = await fetch(resource, init);
    
    // Check content type to ensure we're expecting JSON
    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const isHtml = contentType.includes('text/html');
    
    try {
      rawText = await response.text();
    } catch (textError) {
      // If we can't read the response text, throw a descriptive error
      const error = new Error(`Failed to read response body: ${textError instanceof Error ? textError.message : 'Unknown error'}`);
      (error as any).status = response.status;
      throw error;
    }
    
    // Detect HTML by checking if text starts with '<' (fallback for misconfigured content-type)
    const looksLikeHtml = rawText.trim().startsWith('<');

    // If we got HTML when expecting JSON, treat it as an error
    if ((isHtml || looksLikeHtml) && !response.ok) {
      const error = new Error(
        `Request failed with ${response.status}: Received HTML instead of JSON`,
      );
      (error as any).status = response.status;
      (error as any).info = { rawText: rawText.substring(0, 200) };
      throw error;
    }

    // If response is HTML with 200 status, something went wrong
    if ((isHtml || looksLikeHtml) && response.ok) {
      const error = new Error('Received HTML response instead of JSON');
      (error as any).status = response.status;
      (error as any).info = { rawText: rawText.substring(0, 200) };
      throw error;
    }

    // Parse JSON safely
    let data: any = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        // If we expected JSON but got something else (like HTML), throw a more helpful error
        if (isJson || looksLikeHtml) {
          const error = new Error(
            `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response appears to be HTML or invalid JSON.`,
          );
          (error as any).status = response.status;
          (error as any).info = { rawText: rawText.substring(0, 200) };
          throw error;
        }
        // If content-type doesn't indicate JSON and doesn't look like HTML, return null
        data = null;
      }
    }

    if (!response.ok) {
      const error = new Error(
        (data as { error?: string } | null)?.error ??
          `Request failed with ${response.status}`,
      );
      (error as any).info = data;
      (error as any).status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return data;
  } catch (error) {
    // Ensure we never throw a SyntaxError from JSON.parse - wrap it in a more descriptive error
    if (error instanceof SyntaxError) {
      const wrappedError = new Error(
        `Received invalid JSON response from server: ${error.message}. Response may be HTML or malformed JSON.`,
      );
      (wrappedError as any).originalError = error;
      (wrappedError as any).status = response?.status;
      (wrappedError as any).info = { rawText: rawText.substring(0, 200) };
      throw wrappedError;
    }
    // Re-throw other errors as-is
    throw error;
  }
};

function ClientProviders({ children }: ClientProvidersProps) {
  // Add global error handler for uncaught SyntaxErrors from JSON parsing
  if (typeof window !== 'undefined') {
    const originalErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      // Check if this is a SyntaxError related to JSON parsing
      if (
        error instanceof SyntaxError &&
        (error.message.includes("Unexpected token") || error.message.includes("JSON"))
      ) {
        console.error(
          '[ClientProviders] Caught uncaught SyntaxError from JSON parsing:',
          {
            message,
            source,
            lineno,
            colno,
            error,
          },
        );
        // Don't prevent default error handling, but log it for debugging
      }
      // Call original error handler if it exists
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      return false;
    };
  }

  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        provider: () => new Map(),
        revalidateOnFocus: false,
        dedupingInterval: 750,
        keepPreviousData: true,
        onError: (error, key) => {
          // Log SWR errors for debugging
          if (error instanceof SyntaxError || error.message.includes('JSON')) {
            console.error('[SWR] Error fetching:', key, error);
          }
        },
      }}
    >
      <Providers>{children}</Providers>
    </SWRConfig>
  );
}

export default ClientProviders;
