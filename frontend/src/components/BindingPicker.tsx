import React, { useEffect, useState } from 'react';
import { BindingDocumentation } from '../types';
import { formatApi } from '../api/client';

interface BindingPickerProps {
  onSelectBinding: (key: string) => void;
}

export const BindingPicker: React.FC<BindingPickerProps> = ({ onSelectBinding }) => {
  const [bindings, setBindings] = useState<BindingDocumentation[]>([]);

  useEffect(() => {
    formatApi.getBindings().then(setBindings).catch(console.error);
  }, []);

  return (
    <div className="w-72 bg-slate-900 border-l border-slate-800 p-4 flex flex-col gap-3 overflow-auto">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Available Bindings</h3>
      <div className="space-y-2 text-xs">
        {bindings.map((b) => (
          <div
            key={b.bindingKey}
            onClick={() => onSelectBinding(`{${b.bindingKey}}`)}
            className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-lg cursor-pointer transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-amber-400 group-hover:text-amber-300">
                {`{${b.bindingKey}}`}
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">{b.category}</span>
            </div>
            <p className="text-slate-400 text-[11px] mt-1">{b.description}</p>
            <p className="text-slate-500 font-mono text-[10px] mt-0.5">e.g. {b.exampleValue}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
