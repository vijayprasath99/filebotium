declare global {
  interface Window {
    electronAPI?: {
      getPath: (file: File) => string;
      revealInFolder?: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      moveToTrash?: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

/**
 * Reveals a file in the OS file manager (Explorer/Finder/etc), or shows the containing folder
 * of a file when `revealFolder` is true. No-op with a status message outside Electron
 * (specs/audit/07_analyze_audit.md AN-5 - previously always a dangling no-op even in Electron,
 * since no IPC bridge for this existed at all).
 */
export async function revealInFileManager(
  filePath: string,
  revealFolder: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.electronAPI?.revealInFolder) {
    return { success: false, error: 'Not available outside the desktop app.' };
  }
  const target = revealFolder ? filePath.replace(/[/\\][^/\\]+$/, '') || filePath : filePath;
  return window.electronAPI.revealInFolder(target);
}

export async function moveToTrash(filePath: string): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !window.electronAPI?.moveToTrash) {
    return { success: false, error: 'Not available outside the desktop app.' };
  }
  return window.electronAPI.moveToTrash(filePath);
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
