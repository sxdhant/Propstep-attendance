"use client";

import { useCallback, useState } from "react";

/**
 * Wraps an async service call and tracks whether it is in flight, so buttons
 * can show a spinner and ignore double clicks.
 */
export function useAction<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (...args: Args): Promise<Result> => {
      setPending(true);
      try {
        return await action(...args);
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  return [run, pending] as const;
}
