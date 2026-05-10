import { useState, useEffect, useCallback } from 'react';

const TARGET_DIR = 'C:\\Users\\lauri\\Google Drive\\tabletop-timeline';

export interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

export function useFiles() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchDir = useCallback(async () => {
    try {
      const dirContents = await window.fsApi.readDir(TARGET_DIR);
      const mdFiles = dirContents.filter((f) => !f.isDirectory && f.name.endsWith('.md'));
      setFiles(mdFiles);
    } catch (error) {
      console.error('Error reading directory:', error);
    }
  }, []);

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
    const unsubscribe = window.fsApi.onFileChange(({ event, path }) => {
      console.log(`File event detected: ${event} on ${path}`);

      if (event === 'add' || event === 'unlink') {
        fetchDir();
      }

      if (
        event === 'change' &&
        activeFile &&
        path.replace(/\\/g, '/') === activeFile.replace(/\\/g, '/')
      ) {
        window.fsApi.readFile(activeFile).then((data) => setContent(data || ''));
      }

      if (
        event === 'unlink' &&
        activeFile &&
        path.replace(/\\/g, '/') === activeFile.replace(/\\/g, '/')
      ) {
        setActiveFile(null);
        setContent('');
      }
    });

    return () => unsubscribe();
  }, [activeFile, fetchDir]);

  const handleCreateNew = async () => {
    const fileName = `Note-${Date.now()}.md`;
    const filePath = `${TARGET_DIR}\\${fileName}`;
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
