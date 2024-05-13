export async function getStringHash(string: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  const newHashBuffer = await crypto.subtle.digest("SHA-1", data);
  const newHash = [...new Uint8Array(newHashBuffer)]
    .map((t) => t.toString(16))
    .join("");
  return newHash;
}
