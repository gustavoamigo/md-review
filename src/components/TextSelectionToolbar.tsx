import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CornerDownLeft, X, Wand2 } from 'lucide-react';

interface TextSelectionToolbarProps {
  selectedText: string;
  selectionCoords: { top: number; left: number } | null;
  onSubmitPrompt: (instruction: string, text: string) => void;
  onClearSelection: () => void;
}

const QUICK_PROMPTS = [
  'Make this shorter',
  'Fix grammar & clarity',
  'Convert to bullet points',
  'Add technical precision',
];

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  selectedText,
  selectionCoords,
  onSubmitPrompt,
  onClearSelection,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset when selection changes
    setPrompt('');
    setIsExpanded(false);
  }, [selectedText]);

  if (!selectionCoords || !selectedText.trim()) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmitPrompt(prompt.trim(), selectedText);
    onClearSelection();
  };

  const handleQuickPrompt = (quickText: string) => {
    onSubmitPrompt(quickText, selectedText);
    onClearSelection();
  };

  return (
    <div
      ref={containerRef}
      style={{
        top: `${Math.max(10, selectionCoords.top - 54)}px`,
        left: `${Math.max(10, Math.min(window.innerWidth - 380, selectionCoords.left))}px`,
      }}
      className="fixed z-40 flex items-center gap-1 rounded-xl border border-indigo-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
    >
      {!isExpanded ? (
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-indigo-900 border-r border-indigo-100">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>AI Edit</span>
          </div>

          <div className="flex items-center gap-1">
            {QUICK_PROMPTS.slice(0, 2).map((item) => (
              <button
                key={item}
                onClick={() => handleQuickPrompt(item)}
                className="rounded-lg bg-indigo-50/80 px-2 py-1 text-[11px] font-medium text-indigo-800 hover:bg-indigo-100 transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 shadow-2xs transition-colors"
          >
            <Wand2 className="h-3 w-3" />
            Custom
          </button>

          <button
            onClick={onClearSelection}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 ml-1.5 shrink-0" />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='What should change? (e.g. "make this shorter")...'
            className="w-64 rounded-md border-0 bg-transparent px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <CornerDownLeft className="h-3 w-3" />
            Ask
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
};
