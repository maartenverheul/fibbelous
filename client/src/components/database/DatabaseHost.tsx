import { useEffect, useState } from "react";
import { DatabaseDisplay, type DatabaseHostVariant } from "./DatabaseDisplay";
import { fetchDatabaseDetail } from "../../lib/database/fetch";
import {
  dbEmptyShell,
  dbMutedText,
  dbRootInline,
  dbRootPage,
} from "../../lib/database/ui";
import { cn } from "../../lib/utils";
import {
  parseDatabaseSchema,
  type DatabaseSchema,
  type WorkspaceDatabaseDetail,
} from "../../lib/database/types";

export type { DatabaseHostVariant };

type DatabaseHostProps = {
  databaseId: string;
  variant?: DatabaseHostVariant;
  className?: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "missing-id" }
  | { status: "not-found"; databaseId: string }
  | { status: "error"; databaseId: string; message: string }
  | {
      status: "ready";
      detail: WorkspaceDatabaseDetail;
      schema: DatabaseSchema;
    };

export function DatabaseHost({
  databaseId,
  variant = "page",
  className,
}: DatabaseHostProps) {
  const [state, setState] = useState<LoadState>(() =>
    databaseId.trim() ? { status: "loading" } : { status: "missing-id" },
  );

  useEffect(() => {
    const id = databaseId.trim();
    if (!id) {
      setState({ status: "missing-id" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const detail = await fetchDatabaseDetail(id);
        if (cancelled) return;

        if (!detail) {
          setState({ status: "not-found", databaseId: id });
          return;
        }

        const schema = parseDatabaseSchema(detail.json);
        if (!schema) {
          setState({
            status: "error",
            databaseId: id,
            message: "Invalid database.json",
          });
          return;
        }

        setState({ status: "ready", detail, schema });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          databaseId: id,
          message:
            error instanceof Error ? error.message : "Failed to load database",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [databaseId]);

  const shell = cn(
    variant === "inline" ? dbRootInline : dbRootPage,
    state.status !== "ready" && dbEmptyShell,
    className,
  );

  if (state.status === "loading") {
    return (
      <div className={shell} aria-busy aria-label="Loading database">
        <div className={dbMutedText}>Loading…</div>
      </div>
    );
  }

  if (state.status === "missing-id") {
    return (
      <div className={shell}>
        <div className={dbMutedText}>Database (missing id)</div>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className={shell}>
        <div className={dbMutedText}>
          Database · {state.databaseId} — not found
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={shell}>
        <div className={dbMutedText}>
          Database · {state.databaseId} — {state.message}
        </div>
      </div>
    );
  }

  return (
    <DatabaseDisplay
      detail={state.detail}
      schema={state.schema}
      variant={variant}
      className={className}
    />
  );
}
