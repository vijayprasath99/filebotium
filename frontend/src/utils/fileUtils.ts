declare global {
  interface Window {
    electronAPI?: {
      getPath: (file: File) => string;
    };
  }
}

/**
 * Extracts the absolute path of a File object.
 * In Electron, it resolves using the native electronAPI.getPath (webUtils.getPathForFile).
 * In browsers or fallbacks, it uses file.path or file.name.
 */
export function getFilePath(file: File): string {
  if (typeof window !== 'undefined' && window.electronAPI?.getPath) {
    try {
      const p = window.electronAPI.getPath(file);
      if (p) return p;
    } catch {
      // Fall through
    }
  }
  return (file as any).path || file.name;
}

export function getFilePaths(files: File[] | FileList): string[] {
  return Array.from(files).map(getFilePath);
}
