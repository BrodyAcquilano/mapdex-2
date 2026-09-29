// src/boundaries/hooks/useCloseBoundarySelectionOnPageChange.js

import { useEffect, useRef } from "react";

/*
 * Closes an open "pick a boundary" step whenever the page changes.
 *
 * Boundary selection state is shared runtime state, but the panel it
 * drives is rendered separately by each page (the engines' AppAdapter
 * for Viewer/Editor, the Layers and Aggregates pages for their own Add
 * workflows). One piece of state, several renderers: leaving a page
 * mid-selection left the flag set, so the picker and its toggle
 * reappeared on whichever page you landed on, over content that had
 * nothing to do with it.
 *
 * Resetting on the page change rather than on each page's unmount keeps
 * the rule in one place instead of asking every current and future
 * renderer to remember to clean up after itself.
 *
 * Deliberately skips the very first run: `currentPage` is already set
 * when a page mounts, and firing then would close a selection the page
 * had only just opened.
 */
export function useCloseBoundarySelectionOnPageChange(currentPage, close) {
  const previousPageRef = useRef(currentPage);
  const closeRef = useRef(close);

  closeRef.current = close;

  useEffect(() => {
    if (previousPageRef.current === currentPage) return;

    previousPageRef.current = currentPage;
    closeRef.current?.();
  }, [currentPage]);
}
