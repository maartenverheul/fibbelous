/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module "frontmatter" {
  export default (content: string, opts?: { safeLoad?: boolean }) => string;
}
