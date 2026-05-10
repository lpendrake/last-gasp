import { useState, useEffect, useCallback } from 'react';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export function useFiles(targetDir: string) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchDir = useCallback(async () => {
    try {
      if (!targetDir) return;
      const dirContents = await window.fsApi.readDir(targetDir);
      const mdFiles = dirContents.filter((f) => !f.isDirectory && f.name.endsWith('.md'));
      setFiles(mdFiles);
    } catch (error) {
      console.error('Error reading directory:', error);
    }
  }, [targetDir]);

  const fetchFile = useCallback(async (filePath: string) => {
    setIsLoading(true);
    try {
      const data = await window.fsApi.readFile(filePath);
      setContent(data || '');
      setActiveFile(filePath);
    } catch (error) {
      console.error('Error reading file:', error);
      setContent('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDir();
  }, [fetchDir]);

  useEffect(() => {
    const unsubscribe = window.fsApi.onFileChange(({ event, path: changedPath }) => {
      console.log(`File event detected: ${event} on ${changedPath}`);

      if (event === 'add' || event === 'unlink') {
        fetchDir();
      }

      if (
        event === 'change' &&
        activeFile &&
        changedPath.replace(/\\/g, '/') === activeFile.replace(/\\/g, '/')
      ) {
        window.fsApi.readFile(activeFile).then((data) => setContent(data || ''));
      }

      if (
        event === 'unlink' &&
        activeFile &&
        changedPath.replace(/\\/g, '/') === activeFile.replace(/\\/g, '/')
      ) {
        setActiveFile(null);
        setContent('');
      }
    });

    return () => unsubscribe();
  }, [activeFile, fetchDir]);

  const handleCreateNew = async () => {
    if (!targetDir) return;
    const fileName = `Note-${Date.now()}.md`;
    const separator = targetDir.includes('\\') ? '\\' : '/';
    const filePath = `${targetDir}${separator}${fileName}`;
    await window.fsApi.writeFile(filePath, `# ${fileName}\n\n`);
    setActiveFile(filePath);
    setContent(`# ${fileName}\n\n`);
  };

  const handleAddLine = async () => {
    if (!activeFile) return;
    const lineCount = content ? content.trimEnd().split('\n').length : 0;
    const lineNumber = lineCount > 0 ? lineCount + 1 : 1;
    const newLine = `[Line ${lineNumber}] Entry added at ${new Date().toLocaleTimeString()}\n`;
    const newContent = content ? `${content}\n${newLine}` : newLine;

    setContent(newContent);
    await window.fsApi.writeFile(activeFile, newContent);
  };

  const handleDelete = async () => {
    if (!activeFile) return;
    await window.fsApi.deleteFile(activeFile);
  };

  return {
    files,
    activeFile,
    content,
    isLoading,
    fetchFile,
    handleCreateNew,
    handleAddLine,
    handleDelete,
  };
}
