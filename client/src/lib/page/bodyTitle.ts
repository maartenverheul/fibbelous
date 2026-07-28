/** Ignore only a trailing EOF newline; keep intentional blank lines in the body. */
function normalizeStoredBody(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

export function bodyMatchesStored(
  editorBody: string,
  storedBody: string,
): boolean {
  return normalizeStoredBody(editorBody) === normalizeStoredBody(storedBody);
}
