/** Reveal a file at an absolute path in the OS file explorer. */
export async function revealInExplorer(absolutePath: string): Promise<boolean> {
  return window.fsApi.showItemInFolder(absolutePath);
}
