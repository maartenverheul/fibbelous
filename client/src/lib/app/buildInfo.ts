/** Build metadata injected at compile time via Vite `define`. */

export const buildInfo = {
  version: __APP_VERSION__,
  buildTime: __BUILD_TIME__,
  gitCommit: __GIT_COMMIT__,
  mode: import.meta.env.MODE,
} as const;

export type BuildInfo = typeof buildInfo;
