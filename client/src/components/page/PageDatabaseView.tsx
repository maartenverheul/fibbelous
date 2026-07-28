import { DatabaseHost } from "../database/DatabaseHost";
import { databaseIdFromBody } from "../../lib/database/block";
import { dbEmptyShell, dbMutedText, dbRootPage } from "../../lib/database/ui";
import { cn } from "../../lib/utils";

type PageDatabaseViewProps = {
  body: string;
};

export function PageDatabaseView({ body }: PageDatabaseViewProps) {
  const databaseId = databaseIdFromBody(body);

  if (!databaseId) {
    return (
      <div className={cn(dbRootPage, dbEmptyShell)}>
        <div className={dbMutedText}>Database (missing id)</div>
      </div>
    );
  }

  return <DatabaseHost databaseId={databaseId} variant="page" />;
}
