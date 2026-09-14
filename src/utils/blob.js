export function dataUriToBlobUrl(dataUri, mimeType) {
  const commaIdx = dataUri.indexOf(",");
  const base64 = dataUri.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
}
