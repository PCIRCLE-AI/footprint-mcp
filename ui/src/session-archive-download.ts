export interface SessionArchiveDownload {
  filename: string;
  base64Data: string;
  mimeType: string;
}

export function downloadSessionArchive(
  archive: SessionArchiveDownload,
  rootDocument: Document = document,
  rootWindow: Window & typeof globalThis = window,
): void {
  const binary = rootWindow.atob(archive.base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: archive.mimeType });
  const downloadUrl = rootWindow.URL.createObjectURL(blob);
  const link = rootDocument.createElement("a");
  link.href = downloadUrl;
  link.download = archive.filename;
  link.style.display = "none";
  rootDocument.body.append(link);
  link.click();
  link.remove();
  rootWindow.URL.revokeObjectURL(downloadUrl);
}
