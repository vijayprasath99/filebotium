import React, { useState, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';

import { getFilePaths } from '../utils/fileUtils';

interface GlobalDropZoneProps {
  onFilesDropped: (paths: string[]) => void;
  children: React.ReactNode;
}

export const GlobalDropZone: React.FC<GlobalDropZoneProps> = ({ onFilesDropped, children }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Failsafe to reset drag state if drag is canceled outside the element or window
  useEffect(() => {
    const handleWindowDragEnd = () => {
      dragCounter.current = 0;
      setIsDragging(false);
    };
    window.addEventListener('dragend', handleWindowDragEnd);
    window.addEventListener('drop', handleWindowDragEnd);
    return () => {
      window.removeEventListener('dragend', handleWindowDragEnd);
      window.removeEventListener('drop', handleWindowDragEnd);
    };
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const paths = getFilePaths(files);
      onFilesDropped(paths);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 flex flex-col overflow-hidden"
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-start justify-center pt-5 bg-blue-600/10 border-2 border-dashed border-blue-500 rounded-lg select-none transition-all">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white shadow-lg rounded-full text-xs font-medium tracking-wide">
            <Upload className="w-4 h-4 animate-bounce pointer-events-none" />
            <span className="pointer-events-none">Drop files anywhere to import into active workspace</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
