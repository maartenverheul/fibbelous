declare module "frontmatter" {
  export default (content: string, opts?: { safeLoad?: boolean }) => string;
}

declare module "A" {
  export function A(): void;
}
