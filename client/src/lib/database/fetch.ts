import type {
  CreateDatabaseResult,
  DatabaseRowsPage,
  DatabaseViewLayout,
  DatabaseViewSort,
  WorkspaceDatabaseDetail,
  WorkspaceDatabaseMeta,
} from "./types";
import type { WorkspacePageDetail } from "../page/types";

type DatabaseFetcher = (
  id: string,
) => Promise<WorkspaceDatabaseDetail | null>;

type DatabaseRowsFetcher = (
  id: string,
  options: {
    limit: number;
    offset: number;
    sort?: DatabaseViewSort | null;
  },
) => Promise<DatabaseRowsPage | null>;

type DatabaseRowCreator = (
  id: string,
  title?: string,
) => Promise<WorkspacePageDetail>;

type DatabasesLister = () => Promise<WorkspaceDatabaseMeta[]>;

type DatabaseCreator = (options?: {
  title?: string;
  parentId?: string;
}) => Promise<CreateDatabaseResult>;

/** Partial view update. Omitted fields are unchanged; `sort: null` clears sort. */
export type DatabaseViewUpdate = {
  name?: string;
  layout?: DatabaseViewLayout;
  sort?: DatabaseViewSort | null;
};

type DatabaseViewUpdater = (
  databaseId: string,
  viewId: string,
  update: DatabaseViewUpdate,
) => Promise<WorkspaceDatabaseDetail>;

let detailFetcher: DatabaseFetcher | null = null;
let rowsFetcher: DatabaseRowsFetcher | null = null;
let rowCreator: DatabaseRowCreator | null = null;
let viewUpdater: DatabaseViewUpdater | null = null;
let databasesLister: DatabasesLister | null = null;
let databaseCreator: DatabaseCreator | null = null;

/** Wired from WorkspaceProvider so BlockNote DOM renders can load databases. */
export function registerDatabaseFetcher(next: DatabaseFetcher | null) {
  detailFetcher = next;
}

export function registerDatabaseRowsFetcher(next: DatabaseRowsFetcher | null) {
  rowsFetcher = next;
}

export function registerDatabaseRowCreator(next: DatabaseRowCreator | null) {
  rowCreator = next;
}

export function registerDatabaseViewUpdater(next: DatabaseViewUpdater | null) {
  viewUpdater = next;
}

export function registerDatabasesLister(next: DatabasesLister | null) {
  databasesLister = next;
}

export function registerDatabaseCreator(next: DatabaseCreator | null) {
  databaseCreator = next;
}

export async function fetchDatabaseDetail(
  id: string,
): Promise<WorkspaceDatabaseDetail | null> {
  if (!detailFetcher) {
    throw new Error("No workspace connection");
  }
  return detailFetcher(id);
}

export async function fetchDatabaseRows(
  id: string,
  options: {
    limit: number;
    offset: number;
    sort?: DatabaseViewSort | null;
  },
): Promise<DatabaseRowsPage | null> {
  if (!rowsFetcher) {
    throw new Error("No workspace connection");
  }
  return rowsFetcher(id, options);
}

export async function createDatabaseRow(
  id: string,
  title?: string,
): Promise<WorkspacePageDetail> {
  if (!rowCreator) {
    throw new Error("No workspace connection");
  }
  return rowCreator(id, title);
}

export async function updateDatabaseView(
  databaseId: string,
  viewId: string,
  update: DatabaseViewUpdate,
): Promise<WorkspaceDatabaseDetail> {
  if (!viewUpdater) {
    throw new Error("No workspace connection");
  }
  return viewUpdater(databaseId, viewId, update);
}

export async function listDatabases(): Promise<WorkspaceDatabaseMeta[]> {
  if (!databasesLister) {
    throw new Error("No workspace connection");
  }
  return databasesLister();
}

export async function createDatabase(options?: {
  title?: string;
  parentId?: string;
}): Promise<CreateDatabaseResult> {
  if (!databaseCreator) {
    throw new Error("No workspace connection");
  }
  return databaseCreator(options);
}
