import { useEffect, useState } from "react";
import { DatabaseDisplay } from "../database/DatabaseDisplay";
import { fetchDatabaseDetail } from "../../lib/database/fetch";
import { databaseIdFromBody } from "../../lib/database/block";
import {
  dbEmptyShell,
  dbMutedText,
  dbRootPage,
} from "../../lib/database/ui";
import { cn } from "../../lib/utils";
import {
  parseDatabaseSchema,
  type DatabaseSchema,
  type WorkspaceDatabaseDetail,
} from "../../lib/database/types";

type PageDatabaseViewProps = {
  body: string;
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

export function PageDatabaseView({ body }: PageDatabaseViewProps) {
  const databaseId = databaseIdFromBody(body);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!databaseId) {
      setState({ status: "missing-id" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        const detail = await fetchDatabaseDetail(databaseId);
        if (cancelled) return;

        if (!detail) {
          setState({ status: "not-found", databaseId });
          return;
        }

        const schema = parseDatabaseSchema(detail.json);
        if (!schema) {
          setState({
            status: "error",
            databaseId,
            message: "Invalid database.json",
          });
          return;
        }

        setState({ status: "ready", detail, schema });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          databaseId,
          message:
            error instanceof Error ? error.message : "Failed to load database",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [databaseId]);

  if (state.status === "loading") {
    return (
      <div
        className={cn(dbRootPage, dbEmptyShell)}
        aria-busy
        aria-label="Loading database"
      >
        <div className={dbMutedText}>Loading…</div>
      </div>
    );
  }

  if (state.status === "missing-id") {
    return (
      <div className={cn(dbRootPage, dbEmptyShell)}>
        <div className={dbMutedText}>Database (missing id)</div>
      </div>
    );
  }

  if (state.status === "not-found") {
    return (
      <div className={cn(dbRootPage, dbEmptyShell)}>
        <div className={dbMutedText}>
          Database · {state.databaseId} — not found
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={cn(dbRootPage, dbEmptyShell)}>
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
      className={dbRootPage}
    />
  );
}
