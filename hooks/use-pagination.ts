"use client";

import { useMemo, useState } from "react";

export interface Pagination<T> {
  page: number;
  setPage: (page: number) => void;
  pageCount: number;
  pageItems: T[];
  total: number;
  /** 1-based index of the first item on the page (0 when empty). */
  from: number;
  to: number;
}

/** Client-side pagination. Call `setPage(1)` whenever filters change. */
export function usePagination<T>(items: T[], pageSize: number): Pagination<T> {
  const [requestedPage, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // A filter can shrink the list below the requested page, so clamp instead of showing an empty page.
  const page = Math.min(requestedPage, pageCount);

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

  return {
    page,
    setPage,
    pageCount,
    pageItems,
    total: items.length,
    from: items.length === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, items.length),
  };
}
