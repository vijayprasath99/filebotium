import React, { useState } from 'react';
import { MediaInfoInspector } from '../types';
import { analyzeApi } from '../api/client';
import { BarChart2, FileSearch } from 'lucide-react';

export const AnalyzePanel: React.FC = () => {
  const [filePath, setFilePath] = useState('');
  const [data, setData] = useState<MediaInfoInspector | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleInspect = async () => {
    if (!filePath.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await analyzeApi.inspectFile(filePath);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <BarChart2 className="w-5 h-5 text-amber-400" />
        <input
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="Enter media file path to inspect streams..."
          className="flex-1 bg-slate-950 px-3 py-2 text-xs text-slate-200 border border-slate-800 rounded-lg outline-none"
        />
        <button
          onClick={handleInspect}
          disabled={isAnalyzing || !filePath.trim()}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <FileSearch className="w-4 h-4" />
          {isAnalyzing ? 'Inspecting...' : 'Inspect MediaInfo'}
        </button>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-auto">
        {!data ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Enter a file path above to inspect video, audio, and subtitle streams.
          </div>
        ) : (
          <div className="space-y-6 text-xs">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-1">
              <h3 className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">General Metadata</h3>
              <p className="text-slate-300"><span className="text-slate-500">Path:</span> {data.filePath}</p>
              <p className="text-slate-300"><span className="text-slate-500">Container:</span> {data.containerFormat}</p>
              <p className="text-slate-300"><span className="text-slate-500">Duration:</span> {Math.round(data.durationMs / 1000)}s</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
