import React, { useState } from 'react';
import { WorkspaceTab } from '../types';
import {
  Folder,
  FolderOpen,
  File,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  FolderEdit,
  FileCheck,
  Wand2,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { MediaInfoInspector } from '../types';
import { analyzeApi, appApi } from '../api/client';
import { getFilePaths } from '../utils/fileUtils';

interface AnalyzePanelProps {
  files?: string[];
  onNavigateTab?: (tab: WorkspaceTab, files?: string[]) => void;
}

interface TypeGroup {
  name: string;
  count: number;
  size: string;
  files: string[];
}

export const AnalyzePanel: React.FC<AnalyzePanelProps> = ({ files, onNavigateTab }) => {
  const [types, setTypes] = useState<TypeGroup[]>([]);
  const [treeFiles, setTreeFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Archives' | 'Types' | 'Parts' | 'Attributes' | 'MediaInfo'>('Types');
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number>(-1);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<MediaInfoInspector | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [expandedTree, setExpandedTree] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: 'info' | 'error' } | null>(null);

  const showStatus = (text: string, kind: 'info' | 'error' = 'info') => {
    setStatusMsg({ text, kind });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; open: boolean } | null>(null);
  const [isSendToOpen, setIsSendToOpen] = useState(false);

  React.useEffect(() => {
    if (files && files.length > 0) {
      populateFiles(files);
    }
  }, [files]);

  const populateFiles = (fileList: string[]) => {
    setTreeFiles(fileList);
    const groups: Record<string, string[]> = {};
    fileList.forEach((f) => {
      const ext = f.split('.').pop()?.toLowerCase() || 'other';
      if (!groups[ext]) groups[ext] = [];
      groups[ext].push(f);
    });
    const typeGroups: TypeGroup[] = Object.entries(groups).map(([ext, items]) => ({
      name: ext,
      count: items.length,
      size: `${items.length} file(s)`,
      files: items,
    }));
    setTypes(typeGroups);
    if (typeGroups.length > 0) setSelectedTypeIdx(0);
    setExpandedTree(true);
    if (fileList.length > 0) {
      handleInspectFile(fileList[0]);
    }
  };

  const handleInspectFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setIsInspecting(true);
    try {
      const data = await analyzeApi.inspectFile(filePath);
      setInspectionData(data);
    } catch (err) {
      console.error('Failed to inspect file:', err);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      open: true,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setIsSendToOpen(false);
  };

  const handleSendTo = (targetTab: WorkspaceTab) => {
    handleCloseContextMenu();
    const group = types[selectedTypeIdx];
    if (onNavigateTab) {
      onNavigateTab(targetTab, group ? group.files : treeFiles);
    }
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const rawPaths = getFilePaths(e.target.files);
      let fileList = rawPaths;
      try {
        const ingested = await appApi.intakeFiles(rawPaths, 'LIST');
        if (ingested && ingested.length > 0) fileList = ingested.map((f) => f.path);
      } catch {
        // fallback to raw paths
      }
      populateFiles(fileList);
    }
    if (e.target) e.target.value = '';
  };

  const handleClear = () => {
    setTreeFiles([]);
    setTypes([]);
    setSelectedTypeIdx(-1);
    setExpandedTree(false);
    setExpandedTypes({});
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {statusMsg && (
        <div
          className={`mx-3 mt-2 px-3 py-1.5 rounded text-xs font-mono break-all ${
            statusMsg.kind === 'error'
              ? 'bg-red-100 border border-red-300 text-red-700'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {statusMsg.text}
        </div>
      )}
      <div
        onClick={handleCloseContextMenu}
        className="flex-1 p-3 flex gap-3 bg-[#ebebeb] text-[#222222] overflow-hidden select-none font-sans"
      >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFilesSelected}
        className="hidden"
      />
      {/* Left Pane: File Tree matching Screenshot 4 */}
      <div className="w-80 flex flex-col min-h-0">
        <div className="pb-1 px-1">
          <span className="text-[12px] font-normal text-[#555555]">File Tree</span>
        </div>

        <div className="flex-1 overflow-y-auto bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] p-2">
          {treeFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs font-sans text-center p-4">
              No files or folders loaded. Click Load to open files.
            </div>
          ) : (
            <div>
              <div
                onClick={() => setExpandedTree(!expandedTree)}
                className="flex items-center gap-1.5 text-[12px] cursor-pointer py-0.5 hover:bg-[#eaf2fc]"
              >
                {expandedTree ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#555555]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#555555]" />
                )}
                <Folder className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-[#111111]">Loaded Files ({treeFiles.length})</span>
              </div>

              {expandedTree && (
                <div className="pl-5 space-y-0.5 border-l border-[#e0e0e0] ml-2 text-[12px]">
                  {treeFiles.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-1.5 py-0.5 truncate" title={f}>
                      <File className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Controls of File Tree */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            onClick={handleLoad}
            className="flex items-center gap-1 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[11px] font-medium text-[#222222] cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Load</span>
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[11px] font-medium text-[#222222] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#555555]" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Right Pane: Detail View & Tabs matching Screenshot 4 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tabs Bar */}
        <div className="flex items-end gap-1 px-1 shrink-0">
          {(['Archives', 'Types', 'Parts', 'Attributes', 'MediaInfo'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-t-[4px] text-[11px] font-medium border-t border-x transition-colors ${
                  isActive
                    ? 'bg-[#0070e0] text-white border-[#0070e0] font-semibold relative z-10 shadow-sm'
                    : 'bg-[#dedede] text-[#666666] border-[#bcbcbc] hover:bg-[#e8e8e8]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Tab Content Container */}
        <div
          onContextMenu={handleContextMenu}
          className="flex-1 overflow-y-auto bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] p-2 -mt-[1px]"
        >
          {activeTab === 'Types' && (
            types.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-sans p-6 text-center">
                No file types analyzed. Click Load to select files.
              </div>
            ) : (
              <div className="space-y-0.5">
                {types.map((group, idx) => {
                  const isSelected = selectedTypeIdx === idx;
                  const isExpanded = expandedTypes[group.name];

                  return (
                    <div key={group.name} className="flex flex-col">
                      <div
                        onClick={() => setSelectedTypeIdx(idx)}
                        onContextMenu={handleContextMenu}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-[2px] cursor-pointer text-[12px] ${
                          isSelected
                            ? 'bg-[#0070e0] text-white font-medium'
                            : 'hover:bg-[#eaf2fc] text-[#111111]'
                        }`}
                      >
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTypes((prev) => ({ ...prev, [group.name]: !prev[group.name] }));
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <Folder className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-amber-500 fill-amber-500'}`} />
                        <span>
                          {group.name} ({group.count} files, {group.size})
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="pl-6 py-0.5 space-y-0.5 text-[#555555] text-[11px]">
                          {group.files.map((f, fi) => (
                            <div key={fi} className="flex items-center gap-1.5 py-0.5">
                              <File className="w-3 h-3 text-[#777777]" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {activeTab === 'MediaInfo' && (
            isInspecting ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-sans p-6 text-center">
                Inspecting media technical parameters...
              </div>
            ) : !selectedFile || !inspectionData ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs font-sans p-6 text-center">
                No media information available. Select a media file to inspect streams.
              </div>
            ) : (
              <div className="p-3 space-y-3 text-xs font-sans">
                {/* File Header */}
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                  <div className="font-semibold text-slate-800 truncate" title={inspectionData.filePath}>
                    {inspectionData.filePath}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
                    <span>Container: <strong className="text-slate-700">{inspectionData.containerFormat}</strong></span>
                    <span>Duration: <strong className="text-slate-700">{inspectionData.durationMs > 0 ? `${Math.round(inspectionData.durationMs / 1000)}s` : 'N/A'}</strong></span>
                    <span>Bitrate: <strong className="text-slate-700">{inspectionData.totalBitrate > 0 ? `${Math.round(inspectionData.totalBitrate / 1000)} kbps` : 'N/A'}</strong></span>
                  </div>
                </div>

                {/* Video Streams */}
                <div>
                  <div className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider mb-1">
                    Video Streams ({inspectionData.videoStreams?.length || 0})
                  </div>
                  {!inspectionData.videoStreams || inspectionData.videoStreams.length === 0 ? (
                    <div className="text-slate-400 text-[11px] italic">No video streams detected.</div>
                  ) : (
                    <div className="space-y-1">
                      {inspectionData.videoStreams.map((vs, vi) => (
                        <div key={vi} className="bg-white border border-slate-200 rounded p-2 text-[11px] flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-600">#{vs.streamIndex} {vs.codec}</span>
                          <span className="text-slate-600">{vs.width}x{vs.height} @ {vs.frameRate}fps ({vs.bitDepth}-bit)</span>
                          {vs.hdrFormat && <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold">{vs.hdrFormat}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audio Streams */}
                <div>
                  <div className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider mb-1">
                    Audio Streams ({inspectionData.audioStreams?.length || 0})
                  </div>
                  {!inspectionData.audioStreams || inspectionData.audioStreams.length === 0 ? (
                    <div className="text-slate-400 text-[11px] italic">No audio streams detected.</div>
                  ) : (
                    <div className="space-y-1">
                      {inspectionData.audioStreams.map((as, ai) => (
                        <div key={ai} className="bg-white border border-slate-200 rounded p-2 text-[11px] flex items-center justify-between">
                          <span className="font-mono font-bold text-purple-600">#{as.streamIndex} {as.codec}</span>
                          <span className="text-slate-600">{as.channels} channels | {as.samplingRateHz} Hz</span>
                          <span className="text-slate-500 font-mono">{as.language || 'und'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtitle Streams */}
                <div>
                  <div className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider mb-1">
                    Subtitle Streams ({inspectionData.subtitleStreams?.length || 0})
                  </div>
                  {!inspectionData.subtitleStreams || inspectionData.subtitleStreams.length === 0 ? (
                    <div className="text-slate-400 text-[11px] italic">No embedded subtitles detected.</div>
                  ) : (
                    <div className="space-y-1">
                      {inspectionData.subtitleStreams.map((ss, si) => (
                        <div key={si} className="bg-white border border-slate-200 rounded p-2 text-[11px] flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-600">#{ss.streamIndex} {ss.format}</span>
                          <span className="text-slate-500 font-mono">{ss.language || 'und'}</span>
                          {ss.isDefault && <span className="bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.5 rounded font-bold">Default</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {activeTab === 'Archives' && (
            <div className="p-3 text-xs">
              <div className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider mb-2">Compressed Archives</div>
              {treeFiles.filter((f) => /\.(zip|rar|7z|tar|gz|bz2|xz|iso)$/i.test(f)).length === 0 ? (
                <div className="text-center text-slate-400 p-4">No compressed archive files found in loaded files.</div>
              ) : (
                <div className="space-y-1">
                  {treeFiles
                    .filter((f) => /\.(zip|rar|7z|tar|gz|bz2|xz|iso)$/i.test(f))
                    .map((f, fi) => (
                      <div key={fi} onClick={() => handleInspectFile(f)} className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 cursor-pointer">
                        <Folder className="w-3.5 h-3.5 text-amber-500" />
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Parts' && (
            <div className="p-3 text-xs">
              <div className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider mb-2">Multi-part Files</div>
              {treeFiles.filter((f) => /\.(part\d+|r\d+|\d{3})$/i.test(f)).length === 0 ? (
                <div className="text-center text-slate-400 p-4">No multi-part files found in loaded files.</div>
              ) : (
                <div className="space-y-1">
                  {treeFiles
                    .filter((f) => /\.(part\d+|r\d+|\d{3})$/i.test(f))
                    .map((f, fi) => (
                      <div key={fi} onClick={() => handleInspectFile(f)} className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 cursor-pointer">
                        <File className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'Attributes' && (
            <div className="p-3 text-xs">
              <div className="font-semibold text-[11px] text-slate-600 uppercase tracking-wider mb-2">File Attributes</div>
              {selectedFile ? (
                <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1.5 font-mono text-[11px]">
                  <div><span className="text-slate-500">File:</span> {selectedFile.split(/[/\\]/).pop()}</div>
                  <div><span className="text-slate-500">Full Path:</span> {selectedFile}</div>
                  <div><span className="text-slate-500">Extension:</span> {selectedFile.split('.').pop()}</div>
                </div>
              ) : (
                <div className="text-center text-slate-400 p-4">Select a file from the tree to view its attributes.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot 4 Authentic White Native Popup Context Menu */}
      {contextMenu && contextMenu.open && (
        <div
          style={{ top: contextMenu.y - 5, left: contextMenu.x - 5 }}
          className="fixed bg-white border border-[#b8b8b8] rounded-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.18)] py-1 w-44 z-50 text-[12px] font-sans text-[#222222] select-none"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Send to with Submenu */}
          <div
            className="relative"
            onMouseEnter={() => setIsSendToOpen(true)}
            onMouseLeave={() => setIsSendToOpen(false)}
          >
            <div className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center justify-between transition-colors">
              <span>Send to</span>
              <ChevronRight className="w-3 h-3" />
            </div>

            {isSendToOpen && (
              <div className="absolute left-full top-0 ml-0.5 bg-white border border-[#b8b8b8] rounded-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.18)] py-1 w-36 text-[#222222]">
                <div
                  onClick={() => handleSendTo('RENAME')}
                  className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FolderEdit className="w-3.5 h-3.5 text-amber-500" />
                  <span>Rename</span>
                </div>
                <div
                  onClick={() => handleSendTo('SFV')}
                  className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SFV</span>
                </div>
                <div
                  onClick={() => handleSendTo('LIST')}
                  className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-2"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>List</span>
                </div>
              </div>
            )}
          </div>

          <div
            onClick={() => {
              if (selectedFile) showStatus(`File: ${selectedFile}`, 'info');
              handleCloseContextMenu();
            }}
            className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5 text-[#666666]" />
            <span>Reveal</span>
          </div>

          <div
            onClick={() => {
              const folder = selectedFile
                ? selectedFile.replace(/[/\\][^/\\]+$/, '')
                : null;
              if (folder) showStatus(`Folder: ${folder}`, 'info');
              handleCloseContextMenu();
            }}
            className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Folder className="w-3.5 h-3.5 text-amber-500" />
            <span>Reveal Folder</span>
          </div>

          <div className="my-1 border-t border-[#e5e5e5]" />

          <div
            onClick={() => {
              const all: Record<string, boolean> = {};
              types.forEach((t) => {
                all[t.name] = true;
              });
              setExpandedTypes(all);
              handleCloseContextMenu();
            }}
            className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <CheckSquare className="w-3 h-3 text-[#666666]" />
            <span>Expand all</span>
          </div>

          <div
            onClick={() => {
              setExpandedTypes({});
              handleCloseContextMenu();
            }}
            className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <CheckSquare className="w-3 h-3 text-[#666666]" />
            <span>Collapse all</span>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};
