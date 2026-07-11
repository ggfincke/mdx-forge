// tests/components/copy-timer.test.ts
// T5: copy feedback timers restart & never outlive the component (F19)

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopyToClipboard } from '../../src/components/base/useCopyToClipboard';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../src/components/internal/constants';

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCopyToClipboard timers (F19)', () => {
  it('a rapid second copy restarts the feedback window', async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('one');
    });
    expect(result.current.copied).toBe(true);

    // second copy before the first window elapses
    await act(async () => {
      vi.advanceTimersByTime(CODE_COPY_FEEDBACK_DURATION_MS - 500);
      await result.current.copy('two');
    });

    // past the first timer's original deadline: feedback must survive
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.copied).toBe(true);

    // full window after the second copy: feedback clears
    await act(async () => {
      vi.advanceTimersByTime(CODE_COPY_FEEDBACK_DURATION_MS);
    });
    expect(result.current.copied).toBe(false);
  });

  it('a failed copy sets no feedback & no timer', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('nope');
    });

    expect(result.current.copied).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmount clears the pending timer', async () => {
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy('bye');
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    // advancing past the window must not warn about unmounted state updates
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      vi.advanceTimersByTime(CODE_COPY_FEEDBACK_DURATION_MS + 100);
    });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
