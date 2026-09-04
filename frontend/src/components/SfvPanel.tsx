import React, { useState } from 'react';
import { ChecksumEntry, HashType } from '../types';
import { CheckSquare, Play, Upload } from 'lucide-react';

export const SfvPanel: React.FC = () => {
  const [entries, setEntries] = useState<ChecksumEntry[]>([]);
  const [hashType, setHashType] = useState<HashType>('CRC32');

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">SFV Checksum & File Verification</span>

          <select
            value={hashType}
            onChange={(e) => setHashType(e.target.value as HashType)}
            className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-lg border border-slate-700 outline-none ml-4"
          >
            <option value="CRC32">CRC32</option>
            <option value="MD5">MD5</option>
            <option value="SHA_1">SHA-1</option>
            <option value="SHA_256">SHA-256</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors">
            <Upload className="w-4 h-4" />
            Load SFV File
          </button>
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
            <Play className="w-4 h-4 fill-white" />
            Verify Hashes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <th className="p-3">File Path</th>
              <th className="p-3 w-32 text-center">Expected Hash</th>
              <th className="p-3 w-32 text-center">Calculated Hash</th>
              <th className="p-3 w-28 text-center">Algorithm</th>
              <th className="p-3 w-24 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Drop files or load a checksum verification file (.sfv, .md5, .sha256) to begin.
                </td>
              </tr>
            ) : (
              entries.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-mono text-slate-200">{item.path}</td>
                  <td className="p-3 text-center font-mono text-slate-400">{item.expectedHash ?? '-'}</td>
                  <td className="p-3 text-center font-mono text-slate-200">{item.calculatedHash ?? '-'}</td>
                  <td className="p-3 text-center text-slate-400 font-bold">{item.hashType}</td>
                  <td className="p-3 text-center font-bold">
                    <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px]">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
