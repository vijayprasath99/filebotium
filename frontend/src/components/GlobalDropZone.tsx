import React, { useState } from 'react';
import { Upload } from 'lucide-react';

interface GlobalDropZoneProps {
  onFilesDropped: (paths: string[]) => void;
  children: React.ReactNode;
}

export const GlobalDropZone: React.FC<GlobalDropZoneProps> = ({ onFilesDropped, children }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const paths = files.map((f) => (f as any).path || f.name);
      onFilesDropped(paths);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 flex flex-col overflow-hidden"
    >
      {isDragging && (
        <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-sm z-50 flex flex-col items-center justify-center border-4 border-dashed border-blue-500 rounded-xl m-4">
          <Upload className="w-16 h-16 text-blue-400 animate-bounce mb-4" />
          <h2 className="text-2xl font-bold text-white">Drop Files to Import</h2>
          <p className="text-slate-300 mt-2">Release mouse to add files to active workspace</p>
        </div>
      )}
      {children}
    </div>
  );
};
