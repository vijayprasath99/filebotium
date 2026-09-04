import React, { useState } from 'react';
import { BindingPicker } from './BindingPicker';
import { X, Check, Code } from 'lucide-react';

interface FormatEditorModalProps {
  isOpen: boolean;
  initialExpression: string;
  onSave: (expression: string) => void;
  onClose: () => void;
}

export const FormatEditorModal: React.FC<FormatEditorModalProps> = ({
  isOpen,
  initialExpression,
  onSave,
  onClose,
}) => {
  const [expression, setExpression] = useState(initialExpression);

  if (!isOpen) return null;

  const handleInsertBinding = (binding: string) => {
    setExpression((prev) => prev + ' ' + binding);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl h-[600px] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-slate-100">Groovy Format Expression Editor</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-6 flex flex-col gap-4">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Format Expression
            </label>
            <textarea
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm text-amber-300 focus:outline-none focus:border-amber-500/50 resize-none"
              placeholder="{n} - {s00e00} - {t}"
            />
          </div>

          <BindingPicker onSelectBinding={handleInsertBinding} />
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(expression);
              onClose();
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            Apply Format
          </button>
        </div>
      </div>
    </div>
  );
};
