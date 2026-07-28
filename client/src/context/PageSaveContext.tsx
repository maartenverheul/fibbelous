import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type PageSaveStatus = "saved" | "unsaved" | "saving" | "error";

const SAVING_MIN_MS = 1200;

type PageSaveEntry = {
  status: Exclude<PageSaveStatus, "saved">;
  error?: string;
};

type PageSaveContextValue = {
  status: PageSaveStatus;
  /** Error details when status is `"error"`; otherwise null. */
  error: string | null;
  /** Update save status for a specific page; the top-bar indicator aggregates all pages. */
  setPageStatus: (
    pageId: string,
    status: PageSaveStatus,
    error?: string | null,
  ) => void;
};

const PageSaveContext = createContext<PageSaveContextValue | null>(null);

function deriveStatus(pages: Map<string, PageSaveEntry>): PageSaveStatus {
  let hasUnsaved = false;
  let hasError = false;
  for (const entry of pages.values()) {
    if (entry.status === "saving") return "saving";
    if (entry.status === "error") hasError = true;
    else if (entry.status === "unsaved") hasUnsaved = true;
  }
  if (hasError) return "error";
  if (hasUnsaved) return "unsaved";
  return "saved";
}

function deriveError(pages: Map<string, PageSaveEntry>): string | null {
  let fallback: string | null = null;
  for (const entry of pages.values()) {
    if (entry.status !== "error") continue;
    if (entry.error?.trim()) return entry.error;
    fallback = "Save failed";
  }
  return fallback;
}

export function PageSaveProvider({ children }: { children: ReactNode }) {
  const pagesRef = useRef(new Map<string, PageSaveEntry>());
  const [status, setStatusState] = useState<PageSaveStatus>("saved");
  const [error, setErrorState] = useState<string | null>(null);
  const savingStartedAtRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyDerived = useCallback((next: PageSaveStatus) => {
    setStatusState(next);
    setErrorState(next === "error" ? deriveError(pagesRef.current) : null);
  }, []);

  const publish = useCallback(
    (next: PageSaveStatus) => {
      if (next === "saving") {
        if (releaseTimerRef.current) {
          clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }
        if (savingStartedAtRef.current === null) {
          savingStartedAtRef.current = Date.now();
        }
        applyDerived("saving");
        return;
      }

      if (next === "saved") {
        setStatusState((current) => {
          if (current !== "saving") {
            savingStartedAtRef.current = null;
            setErrorState(null);
            return "saved";
          }

          if (releaseTimerRef.current) {
            return current;
          }

          const started = savingStartedAtRef.current ?? Date.now();
          const remaining = SAVING_MIN_MS - (Date.now() - started);
          if (remaining <= 0) {
            savingStartedAtRef.current = null;
            setErrorState(null);
            return "saved";
          }

          releaseTimerRef.current = setTimeout(() => {
            savingStartedAtRef.current = null;
            releaseTimerRef.current = null;
            applyDerived(deriveStatus(pagesRef.current));
          }, remaining);

          return current;
        });
        return;
      }

      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      savingStartedAtRef.current = null;
      applyDerived(next);
    },
    [applyDerived],
  );

  const setPageStatus = useCallback(
    (pageId: string, next: PageSaveStatus, nextError?: string | null) => {
      if (!pageId) return;

      if (next === "saved") {
        pagesRef.current.delete(pageId);
      } else if (next === "error") {
        const message = nextError?.trim();
        pagesRef.current.set(pageId, {
          status: "error",
          ...(message ? { error: message } : {}),
        });
      } else {
        pagesRef.current.set(pageId, { status: next });
      }

      publish(deriveStatus(pagesRef.current));
    },
    [publish],
  );

  useEffect(
    () => () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ status, error, setPageStatus }),
    [status, error, setPageStatus],
  );
  return (
    <PageSaveContext.Provider value={value}>{children}</PageSaveContext.Provider>
  );
}

export function usePageSave() {
  const context = useContext(PageSaveContext);
  if (!context) {
    throw new Error("usePageSave must be used within PageSaveProvider");
  }
  return context;
}
