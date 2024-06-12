import { PageMeta } from ".";

export type NavigatorChangeEvent = {
  added?: PageMeta[];
  updated?: PageMeta[];
  deleted?: string[];
};
