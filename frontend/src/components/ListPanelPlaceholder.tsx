import React from 'react';
import { ListOrdered } from 'lucide-react';

interface ListPanelPlaceholderProps {
  files: string[];
}

/**
 * Stub for the legacy Groovy-pattern-driven sequence generator (net.filebot.ui.list.ListPanel).
 * Tracked in specs/DETAILED_IMPLEMENTATION_PLAN.md Phase 3.6 - real implementation needs its
 * own spec (specs/11_LIST_PANEL_AND_SEQUENCE_GENERATOR.md) before being built out.
 */
export const ListPanelPlaceholder: React.FC<ListPanelPlaceholderProps> = ({ files }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#666666] bg-white">
      <ListOrdered className="w-10 h-10 text-amber-500" />
      <div className="text-sm font-medium">List / Sequence Generator</div>
      <div className="text-xs text-[#999999] max-w-xs text-center">
        Not yet implemented. This will host the Groovy-format-driven sequence generator
        (From/To ranges, Load/Save, Send to).
      </div>
      {files.length > 0 && (
        <div className="text-xs text-[#999999]">{files.length} file(s) received</div>
      )}
    </div>
  );
};

export default ListPanelPlaceholder;
