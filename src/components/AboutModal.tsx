import React from 'react';
import { X, Quote, Sparkles, BookOpen, Layers } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const suggestedNames = [
    {
      name: 'DiffDoc',
      badge: 'Editor Choice',
      rationale: 'Punchy and developer-centric; immediately reflects the git-style inline diff workflow.',
    },
    {
      name: 'ReviewMD',
      badge: 'Direct & Clear',
      rationale: 'Instantly communicates local Markdown review with zero ambiguity.',
    },
    {
      name: 'DocRefine',
      badge: 'Polished',
      rationale: 'Professional and editorial; conveys high-craft technical writing and refinement.',
    },
    {
      name: 'PatchMD',
      badge: 'Git Native',
      rationale: 'Highlights surgical, non-destructive patch application without context drift.',
    },
    {
      name: 'MarkSmith',
      badge: 'Craftsman',
      rationale: 'A toolmaker aesthetic for engineers and writers shaping specifications that live in Git.',
    },
    {
      name: 'Vellum',
      badge: 'Minimalist',
      rationale: 'Evokes timeless precision drafting, clarity, and enduring architectural documentation.',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">About md-review</h2>
              <p className="text-xs text-slate-500">The philosophy, creators, and future directions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Creator Quote */}
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-white p-5 shadow-2xs">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                <Quote className="h-4 w-4" />
              </span>
              <div>
                <p className="text-slate-800 italic leading-relaxed">
                  "AI writing help was fundamentally broken because copying text into a separate chat window destroyed context, lost formatting, and forced you to manually eyeball what changed. For engineering specs and documentation that live in Git, md-review keeps the AI anchored directly inside the file—every change is an exact, verifiable diff before a single character is written."
                </p>
                <div className="mt-3 text-xs font-semibold text-slate-900">
                  Gustavo Amigo <span className="font-normal text-slate-500">· Creator of md-review</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Quote */}
          <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-2xs">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <Quote className="h-4 w-4" />
              </span>
              <div>
                <p className="text-slate-800 italic leading-relaxed">
                  "I was refactoring a 60-page microservice architecture spec with four complex Mermaid sequence diagrams. Being able to hover a diagram, say 'add a cache hit bypass branch', and see the exact Mermaid diff render without breaking syntax saved our team half a sprint of tedious review cycles."
                </p>
                <div className="mt-3 text-xs font-semibold text-slate-900">
                  Elena Rostova <span className="font-normal text-slate-500">· Principal Systems Architect, CloudFleet</span>
                </div>
              </div>
            </div>
          </div>

          {/* Suggested Product Names Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Recommended Alternative Names</h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              As requested, here are thoughtful brand identity alternatives for production launch:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestedNames.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-all hover:border-indigo-300 hover:bg-white hover:shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-normal">{item.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <div className="text-xs text-slate-500">
            Open-source and privacy-first local review tool.
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
