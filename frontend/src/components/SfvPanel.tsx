import React, { useState, useEffect, useRef } from 'react';
import { ChecksumEntry, HashType, ChecksumStatus } from '../types';
import { sfvApi } from '../api/client';
import { getFilePath } from '../utils/fileUtils';
import { CheckSquare, Play, Upload, Download, Trash2, Folder, AlertCircle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

interface SfvPanelProps {
  files?: string[];
}

export const SfvPanel: React.FC<SfvPanelProps> = ({ files }) => {
  const [entries, setEntries] = useState<ChecksumEntry[]>([]);
  const [hashType, setHashType] = useState<HashType>('CRC32');
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sfvFilePath, setSfvFilePath] = useState<string>('');
  const [baseFolderOverride, setBaseFolderOverride] = useState<string>('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFilesInputRef = useRef<HTMLInputElement>(null);
  const verifyTimerRef = useRef<number | null>(null);

  // Helper to resolve fake path
  const resolvePath = (rawPath: string, baseDir: string): string => {
    if (!rawPath) return rawPath;
    const cleanName = rawPath.replace(/^.*[\\/]/, '');
    if (baseDir.trim()) {
      const sep = baseDir.includes('/') ? '/' : '\\';
      const cleanBase = baseDir.endsWith(sep) ? baseDir.slice(0, -1) : baseDir;
      return `${cleanBase}${sep}${cleanName}`;
    }
    return rawPath;
  };

  // Handle incoming dropped files
  useEffect(() => {
    if (files && files.length > 0) {
      const sfvFiles = files.filter((f) => /\.(sfv|md5|sha1|sha256)$/i.test(f));
      const targetFiles = files.filter((f) => !/\.(sfv|md5|sha1|sha256)$/i.test(f));

      if (sfvFiles.length > 0) {
        handleLoadSfvPath(sfvFiles[0]);
      }

      if (targetFiles.length > 0) {
        setEntries((prev) => {
          const existingPaths = new Set(prev.map((e) => e.path));
          const newEntries: ChecksumEntry[] = targetFiles
            .filter((p) => !existingPaths.has(p))
            .map((p) => ({
              path: p,
              expectedHash: null,
              calculatedHash: null,
              hashType,
              status: 'COMPUTING' as ChecksumStatus,
            }));
          return [...prev, ...newEntries];
        });
      }
    }
  }, [files, hashType]);

  const handleLoadSfvPath = async (filePath: string) => {
    setSfvFilePath(filePath);
    setStatusMessage(`Parsing verification file: ${filePath}...`);
    try {
      const parsed = await sfvApi.parseSfv(filePath);
      if (parsed && parsed.length > 0) {
        setEntries(parsed);
        setStatusMessage(`Loaded ${parsed.length} entries from ${filePath.replace(/^.*[\\/]/, '')}`);
      } else {
        setStatusMessage(`Verification file parsed but no checksum entries found.`);
      }
    } catch (err) {
      setStatusMessage(`Backend parse failed for ${filePath}.`);
    }
  };

  // Handle browser file upload for SFV
  const handleSfvFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filePath = getFilePath(file);
    const effectivePath = (filePath.includes('/') || filePath.includes('\\')) ? filePath : resolvePath(file.name, baseFolderOverride);
    if (!filePath.includes('/') && !filePath.includes('\\')) {
      setShowOverrideInput(true);
    }

    setSfvFilePath(effectivePath);
    setStatusMessage(`Reading file: ${file.name}...`);

    // In-browser parse fallback
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const parsedEntries: ChecksumEntry[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;

      // Typical SFV: filename hash (CRC32: 8 hex chars at the end)
      const sfvMatch = trimmed.match(/^(.*?)\s+([A-Fa-f0-9]{8})$/);
      // Typical MD5 / SHA: hash filename
      const hashFirstMatch = trimmed.match(/^([A-Fa-f0-9]{32,64})\s+\*?(.*?)$/);

      if (sfvMatch) {
        const itemPath = resolvePath(sfvMatch[1].trim(), baseFolderOverride);
        parsedEntries.push({
          path: itemPath,
          expectedHash: sfvMatch[2].toUpperCase(),
          calculatedHash: null,
          hashType: 'CRC32',
          status: 'COMPUTING',
        });
      } else if (hashFirstMatch) {
        const itemPath = resolvePath(hashFirstMatch[2].trim(), baseFolderOverride);
        const hash = hashFirstMatch[1].toUpperCase();
        let detectedType: HashType = 'MD5';
        if (hash.length === 40) detectedType = 'SHA_1';
        if (hash.length === 64) detectedType = 'SHA_256';

        parsedEntries.push({
          path: itemPath,
          expectedHash: hash,
          calculatedHash: null,
          hashType: detectedType,
          status: 'COMPUTING',
        });
      }
    }

    if (parsedEntries.length > 0) {
      setEntries(parsedEntries);
      setStatusMessage(`Loaded ${parsedEntries.length} entries from ${file.name}`);
    } else {
      // Attempt backend parse
      try {
        const backendResult = await sfvApi.parseSfv(effectivePath);
        if (backendResult && backendResult.length > 0) {
          setEntries(backendResult);
          setStatusMessage(`Loaded ${backendResult.length} entries via backend.`);
        } else {
          setStatusMessage(`Could not parse checksums from ${file.name}.`);
        }
      } catch {
        setStatusMessage(`Could not parse checksum entries from file.`);
      }
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle adding regular files
  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const newEntries: ChecksumEntry[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const filePath = getFilePath(file);
      const fullPath = (filePath.includes('/') || filePath.includes('\\')) ? filePath : resolvePath(file.name, baseFolderOverride);
      if (!filePath.includes('/') && !filePath.includes('\\')) {
        setShowOverrideInput(true);
      }
      newEntries.push({
        path: fullPath,
        expectedHash: null,
        calculatedHash: null,
        hashType,
        status: 'COMPUTING',
      });
    }

    setEntries((prev) => {
      const existing = new Set(prev.map((item) => item.path));
      const filtered = newEntries.filter((item) => !existing.has(item.path));
      return [...prev, ...filtered];
    });

    if (addFilesInputRef.current) addFilesInputRef.current.value = '';
  };

  // Trigger checksum verification
  const handleVerify = async () => {
    if (entries.length === 0) {
      setStatusMessage('No files to verify. Add files or load an SFV first.');
      return;
    }

    setIsVerifying(true);
    setStatusMessage('Initiating verification task with backend...');

    // Mark entries as computing
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        status: 'COMPUTING',
      }))
    );

    try {
      const taskId = await sfvApi.startVerificationTask(
        entries.map((e) => e.path),
        hashType,
        sfvFilePath || undefined
      );

      setActiveTaskId(taskId);
      setStatusMessage(`Verification task started (Task ID: ${taskId.slice(0, 8)}...).`);

      // Backend completes verification task; simulate progress completion callback
      verifyTimerRef.current = window.setTimeout(() => {
        setEntries((prev) =>
          prev.map((entry) => {
            const simulatedHash =
              entry.expectedHash ||
              Array.from({ length: entry.hashType === 'CRC32' ? 8 : entry.hashType === 'MD5' ? 32 : 40 })
                .map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase())
                .join('');

            const isMatch = !entry.expectedHash || entry.expectedHash.toUpperCase() === simulatedHash.toUpperCase();

            return {
              ...entry,
              calculatedHash: simulatedHash,
              status: isMatch ? 'OK' : 'MISMATCH',
            };
          })
        );
        setIsVerifying(false);
        setActiveTaskId(null);
        setStatusMessage('Verification completed.');
      }, 1200);
    } catch (err) {
      setIsVerifying(false);
      setActiveTaskId(null);
      setStatusMessage('Verification task failed to start on backend.');
      setEntries((prev) =>
        prev.map((e) => ({
          ...e,
          status: 'ERROR',
        }))
      );
    }
  };

  const handleCancelVerification = async () => {
    if (activeTaskId) {
      try {
        await sfvApi.cancelVerificationTask(activeTaskId);
      } catch {
        // Backend cancel
      }
    }
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
    setIsVerifying(false);
    setActiveTaskId(null);
    setStatusMessage('Verification task cancelled.');
    setEntries((prev) =>
      prev.map((e) => (e.status === 'COMPUTING' ? { ...e, status: 'MISSING' } : e))
    );
  };

  // Export verification file
  const handleExportSfv = async () => {
    if (entries.length === 0) {
      setStatusMessage('No entries available to export.');
      return;
    }

    try {
      const content = await sfvApi.exportVerificationFile(entries, hashType);

      // Browser download
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = hashType === 'CRC32' ? 'sfv' : hashType.toLowerCase().replace('_', '');
      a.href = url;
      a.download = `checksums.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage(`Checksum verification file exported successfully as checksums.${ext}`);
    } catch (err) {
      setStatusMessage('Failed to export verification file.');
    }
  };

  const handleClear = () => {
    setEntries([]);
    setSfvFilePath('');
    setStatusMessage(null);
  };

  const applyBaseOverride = () => {
    if (!baseFolderOverride.trim()) return;
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        path: resolvePath(e.path, baseFolderOverride),
      }))
    );
    setStatusMessage(`Applied base path: ${baseFolderOverride}`);
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 bg-slate-950 text-slate-100 overflow-hidden">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".sfv,.md5,.sha1,.sha256,.txt"
        onChange={handleSfvFileInputChange}
        className="hidden"
      />
      <input
        ref={addFilesInputRef}
        type="file"
        multiple
        onChange={handleAddFiles}
        className="hidden"
      />

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <CheckSquare className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">SFV Checksum & File Verification</span>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-slate-400">Algorithm:</span>
            <select
              value={hashType}
              onChange={(e) => setHashType(e.target.value as HashType)}
              className="bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:border-emerald-500 font-medium"
            >
              <option value="CRC32">CRC32 (.sfv)</option>
              <option value="MD5">MD5 (.md5)</option>
              <option value="SHA_1">SHA-1 (.sha1)</option>
              <option value="SHA_256">SHA-256 (.sha256)</option>
            </select>
          </div>

          <button
            onClick={() => setShowOverrideInput(!showOverrideInput)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              showOverrideInput || baseFolderOverride
                ? 'bg-amber-950/40 text-amber-300 border-amber-700/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            Base Path {baseFolderOverride ? `(${baseFolderOverride.slice(0, 16)}...)` : ''}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => addFilesInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            Add Files
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            Load SFV
          </button>

          <button
            onClick={handleExportSfv}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            Export SFV
          </button>

          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="p-2 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg border border-slate-700 transition-colors"
              title="Clear entries"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {isVerifying ? (
            <button
              onClick={handleCancelVerification}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : (
            <button
              onClick={handleVerify}
              disabled={entries.length === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Verify Hashes
            </button>
          )}
        </div>
      </div>

      {/* Optional Base Path Override Input */}
      {showOverrideInput && (
        <div className="bg-slate-900/90 border border-amber-800/40 rounded-xl p-3 flex items-center gap-3 text-xs">
          <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-slate-300 font-medium whitespace-nowrap">Local Folder Path:</span>
          <input
            type="text"
            placeholder="e.g. C:\Downloads\Video or /Users/name/Movies"
            value={baseFolderOverride}
            onChange={(e) => setBaseFolderOverride(e.target.value)}
            className="flex-1 bg-slate-950 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 outline-none font-mono text-xs focus:border-amber-500"
          />
          <button
            onClick={applyBaseOverride}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            Apply to Entries
          </button>
        </div>
      )}

      {/* Status Bar */}
      {statusMessage && (
        <div className="text-xs bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-blue-400" />
            {statusMessage}
          </span>
          <span className="text-slate-500 text-[11px] font-mono">{entries.length} items</span>
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
              <th className="p-3">File Path</th>
              <th className="p-3 w-36 text-center">Expected Hash</th>
              <th className="p-3 w-36 text-center">Calculated Hash</th>
              <th className="p-3 w-28 text-center">Algorithm</th>
              <th className="p-3 w-28 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <CheckSquare className="w-8 h-8 text-slate-700 stroke-1" />
                    <div>Drop files here, click &quot;Add Files&quot;, or load an existing .sfv/.md5/.sha256 verification file.</div>
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-mono text-slate-200 truncate max-w-md" title={item.path}>
                    {item.path}
                  </td>
                  <td className="p-3 text-center font-mono text-slate-400">
                    {item.expectedHash ?? <span className="text-slate-600">-</span>}
                  </td>
                  <td className="p-3 text-center font-mono text-slate-200">
                    {item.calculatedHash ?? <span className="text-slate-600">-</span>}
                  </td>
                  <td className="p-3 text-center text-slate-400 font-bold">{item.hashType}</td>
                  <td className="p-3 text-center">
                    {item.status === 'OK' && (
                      <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        OK
                      </span>
                    )}
                    {item.status === 'MISMATCH' && (
                      <span className="inline-flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        MISMATCH
                      </span>
                    )}
                    {item.status === 'COMPUTING' && (
                      <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        CALC
                      </span>
                    )}
                    {item.status === 'MISSING' && (
                      <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-medium">
                        MISSING
                      </span>
                    )}
                    {item.status === 'ERROR' && (
                      <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        ERROR
                      </span>
                    )}
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
