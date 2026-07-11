// src/components/base/useCopyToClipboard.ts
// shared hook for copy-to-clipboard functionality

import { useState, useCallback, useEffect, useRef } from 'react';
import { copyToClipboard } from '../internal/clipboard';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../internal/constants';

// result from useCopyToClipboard hook
export interface UseCopyToClipboardResult {
  // feedback state
  copied: boolean;
  copy: (text: string) => Promise<void>;
}

// hook for copy-to-clipboard functionality w/ visual feedback
export function useCopyToClipboard(): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // clear any pending feedback timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copy = useCallback(async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      // restart the feedback window on every successful copy
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCopied(false);
      }, CODE_COPY_FEEDBACK_DURATION_MS);
    }
  }, []);

  return { copied, copy };
}
