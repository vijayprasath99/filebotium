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

interface AnalyzePanelProps {
  onNavigateTab?: (tab: WorkspaceTab, files?: string[]) => void;
}

interface TypeGroup {
  name: string;
  count: number;
  size: string;
  files: string[];
}

const DEFAULT_TYPES: TypeGroup[] = [
  {
    name: 'Episode',
    count: 12,
    size: '4 GB',
    files: [
      'Firefly - 1x01 - Serenity.mkv',
      'Firefly - 1x02 - The Train Job.mkv',
      'Firefly - 1x03 - Bushwhacked.mkv',
      'Firefly - 1x04 - Shindig.mkv',
      'Firefly - 1x05 - Safe.mkv',
    ],
  },
  {
    name: 'Video',
    count: 12,
    size: '4 GB',
    files: [
      'Firefly - 1x01 - Serenity.mkv',
      'Firefly - 1x02 - The Train Job.mkv',
      'Firefly - 1x03 - Bushwhacked.mkv',
      'Firefly - 1x04 - Shindig.mkv',
      'Firefly - 1x05 - Safe.mkv',
    ],
  },
  {
    name: 'jpg',
    count: 4,
    size: '1 MB',
    files: ['poster.jpg', 'fanart.jpg', 'season01.jpg', 'banner.jpg'],
  },
  {
    name: 'mkv',
    count: 12,
    size: '4 GB',
    files: [
      'Firefly.1x01.mkv',
      'Firefly.1x02.mkv',
      'Firefly.1x03.mkv',
    ],
  },
  {
    name: 'nfo',
    count: 1,
    size: '1 KB',
    files: ['tvshow.nfo'],
  },
];

export const AnalyzePanel: React.FC<AnalyzePanelProps> = ({ onNavigateTab }) => {
  const [activeTab, setActiveTab] = useState<'Archives' | 'Types' | 'Parts' | 'Attributes' | 'MediaInfo'>('Types');
  const [selectedTypeIdx, setSelectedTypeIdx] = useState<number>(1); // 'Video' selected as in Screenshot 4
  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [expandedTree, setExpandedTree] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; open: boolean } | null>(null);
  const [isSendToOpen, setIsSendToOpen] = useState(false);

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
    const group = DEFAULT_TYPES[selectedTypeIdx];
    if (onNavigateTab) {
      onNavigateTab(targetTab, group ? group.files : []);
    }
  };

  return (
    <div
      onClick={handleCloseContextMenu}
      className="flex-1 p-3 flex gap-3 bg-[#ebebeb] text-[#222222] overflow-hidden select-none font-sans"
    >
      {/* Left Pane: File Tree matching Screenshot 4 */}
      <div className="w-80 flex flex-col min-h-0">
        <div className="pb-1 px-1">
          <span className="text-[12px] font-normal text-[#555555]">File Tree</span>
        </div>

        <div className="flex-1 overflow-y-auto bg-white border border-[#a8a8a8] rounded-[2px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] p-2">
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
            <span className="text-[#111111]">TV Shows</span>
          </div>

          {expandedTree && (
            <div className="pl-5 space-y-0.5 border-l border-[#e0e0e0] ml-2 text-[12px]">
              <div className="flex items-center gap-1.5 py-0.5">
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>Firefly (12 files)</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls of File Tree */}
        <div className="pt-2 flex items-center justify-center gap-2">
          <button
            onClick={() => alert('Loaded file tree')}
            className="flex items-center gap-1 px-3 py-1 bg-gradient-to-b from-white via-[#f8f8f8] to-[#e4e4e4] hover:from-white hover:to-[#dadada] active:from-[#dcdcdc] active:to-[#cdcdcd] border border-[#a0a0a0] rounded-[4px] shadow-sm text-[11px] font-medium text-[#222222] cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Load</span>
          </button>
          <button
            onClick={() => setExpandedTree(false)}
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
            <div className="space-y-0.5">
              {DEFAULT_TYPES.map((group, idx) => {
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
          )}

          {activeTab === 'MediaInfo' && (
            <div className="p-3 text-xs space-y-2 font-sans">
              <h4 className="font-bold text-[#333333]">General Stream Information</h4>
              <p>Format: Matroska (MKV)</p>
              <p>Duration: 44m 12s</p>
              <p>Bitrate: 4 820 kb/s</p>
            </div>
          )}

          {activeTab === 'Archives' && (
            <div className="p-4 text-center text-[#888888] text-xs">
              No archives loaded.
            </div>
          )}

          {activeTab === 'Parts' && (
            <div className="p-4 text-center text-[#888888] text-xs">
              No multi-part files found.
            </div>
          )}

          {activeTab === 'Attributes' && (
            <div className="p-3 text-xs">
              <p className="font-mono text-[#555555]">net.filebot.metadata: Firefly (2002)</p>
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
              alert('Revealed');
              handleCloseContextMenu();
            }}
            className="px-3 py-1 hover:bg-[#0070e0] hover:text-white cursor-pointer flex items-center gap-2"
          >
            <Eye className="w-3.5 h-3.5 text-[#666666]" />
            <span>Reveal</span>
          </div>

          <div
            onClick={() => {
              alert('Revealed enclosing folder');
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
              setExpandedTypes({ Episode: true, Video: true, jpg: true, mkv: true, nfo: true });
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
  );
};
