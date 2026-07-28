import type {
  CreateDatabaseResult,
  DatabaseRowsPage,
  DatabaseViewLayout,
  DatabaseViewProperty,
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
  properties?: DatabaseViewProperty[];
};

export type CreateDatabaseViewInput = {
  name?: string;
  layout?: DatabaseViewLayout;
  copyFromViewId?: string;
};

export type CreateDatabaseViewResult = {
  database: WorkspaceDatabaseDetail;
  viewId: string;
};

type DatabaseViewUpdater = (
  databaseId: string,
  viewId: string,
  update: DatabaseViewUpdate,
) => Promise<WorkspaceDatabaseDetail>;

type DatabaseViewCreator = (
  databaseId: string,
  input?: CreateDatabaseViewInput,
) => Promise<CreateDatabaseViewResult>;

type DatabaseViewDeleter = (
  databaseId: string,
  viewId: string,
) => Promise<WorkspaceDatabaseDetail>;

let detailFetcher: DatabaseFetcher | null = null;
let rowsFetcher: DatabaseRowsFetcher | null = null;
let rowCreator: DatabaseRowCreator | null = null;
let viewUpdater: DatabaseViewUpdater | null = null;
let viewCreator: DatabaseViewCreator | null = null;
let viewDeleter: DatabaseViewDeleter | null = null;
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

export function registerDatabaseViewCreator(next: DatabaseViewCreator | null) {
  viewCreator = next;
}

export function registerDatabaseViewDeleter(next: DatabaseViewDeleter | null) {
  viewDeleter = next;
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

export async function createDatabaseView(
  databaseId: string,
  input?: CreateDatabaseViewInput,
): Promise<CreateDatabaseViewResult> {
  if (!viewCreator) {
    throw new Error("No workspace connection");
  }
  return viewCreator(databaseId, input);
}

export async function deleteDatabaseView(
  databaseId: string,
  viewId: string,
): Promise<WorkspaceDatabaseDetail> {
  if (!viewDeleter) {
    throw new Error("No workspace connection");
  }
  return viewDeleter(databaseId, viewId);
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
