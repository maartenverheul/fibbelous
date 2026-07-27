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

type PageSaveContextValue = {
  status: PageSaveStatus;
  /** Update save status for a specific page; the top-bar indicator aggregates all pages. */
  setPageStatus: (pageId: string, status: PageSaveStatus) => void;
};

const PageSaveContext = createContext<PageSaveContextValue | null>(null);

function deriveStatus(pages: Map<string, PageSaveStatus>): PageSaveStatus {
  let hasUnsaved = false;
  let hasError = false;
  for (const status of pages.values()) {
    if (status === "saving") return "saving";
    if (status === "error") hasError = true;
    else if (status === "unsaved") hasUnsaved = true;
  }
  if (hasError) return "error";
  if (hasUnsaved) return "unsaved";
  return "saved";
}

export function PageSaveProvider({ children }: { children: ReactNode }) {
  const pagesRef = useRef(new Map<string, PageSaveStatus>());
  const [status, setStatusState] = useState<PageSaveStatus>("saved");
  const savingStartedAtRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publish = useCallback((next: PageSaveStatus) => {
    if (next === "saving") {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
      if (savingStartedAtRef.current === null) {
        savingStartedAtRef.current = Date.now();
      }
      setStatusState("saving");
      return;
    }

    if (next === "saved") {
      setStatusState((current) => {
        if (current !== "saving") {
          savingStartedAtRef.current = null;
          return "saved";
        }

        if (releaseTimerRef.current) {
          return current;
        }

        const started = savingStartedAtRef.current ?? Date.now();
        const remaining = SAVING_MIN_MS - (Date.now() - started);
        if (remaining <= 0) {
          savingStartedAtRef.current = null;
          return "saved";
        }

        releaseTimerRef.current = setTimeout(() => {
          savingStartedAtRef.current = null;
          releaseTimerRef.current = null;
          setStatusState(deriveStatus(pagesRef.current));
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
    setStatusState(next);
  }, []);

  const setPageStatus = useCallback(
    (pageId: string, next: PageSaveStatus) => {
      if (!pageId) return;

      if (next === "saved") {
        pagesRef.current.delete(pageId);
      } else {
        pagesRef.current.set(pageId, next);
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
    () => ({ status, setPageStatus }),
    [status, setPageStatus],
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
