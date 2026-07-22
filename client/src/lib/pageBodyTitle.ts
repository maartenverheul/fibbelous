function normalizeStoredBody(body: string): string {
  return body.replace(/\n{3,}/g, "\n\n").trimEnd();
}

export function bodyMatchesStored(
  editorBody: string,
  storedBody: string,
): boolean {
  return normalizeStoredBody(editorBody) === normalizeStoredBody(storedBody);
}
