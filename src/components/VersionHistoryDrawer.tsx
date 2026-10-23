import React, { useState } from 'react';
import { History, X, RotateCcw, Download, Eye, Plus, Sparkles, User, FileText, ArrowLeft, ArrowRight } from 'lucide-react';
import * as Diff from 'diff';
import { DocumentSnapshot } from '../types';

interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: DocumentSnapshot[];
  currentContent: string;
  onRevertToSnapshot: (snapshot: DocumentSnapshot) => void;
  onCreateCheckpoint: (label: string) => void;
}

export const VersionHistoryDrawer: React.FC<VersionHistoryDrawerProps> = ({
  isOpen,
  onClose,
  snapshots,
  currentContent,
  onRevertToSnapshot,
  onCreateCheckpoint,
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<DocumentSnapshot | null>(null);
  const [newCheckpointName, setNewCheckpointName] = useState('');
  const [showAddCheckpoint, setShowAddCheckpoint] = useState(false);
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified');

  if (!isOpen) return null;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckpointName.trim()) return;
    onCreateCheckpoint(newCheckpointName.trim());
    setNewCheckpointName('');
    setShowAddCheckpoint(false);
  };

  const handleDownloadSnapshot = (snapshot: DocumentSnapshot) => {
    const blob = new Blob([snapshot.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snapshot-${new Date(snapshot.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Compute diff between selected snapshot and current content
  const snapshotDiffWords = selectedSnapshot
    ? Diff.diffWordsWithSpace(selectedSnapshot.content, currentContent)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform border-l border-slate-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Version History &amp; Snapshots</h2>
              <p className="text-xs text-slate-500">
                Track AI modifications, view full diffs, and safely revert anytime
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCheckpoint(!showAddCheckpoint)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 text-slate-500" />
              Checkpoint
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Create Manual Checkpoint Form */}
        {showAddCheckpoint && (
          <form onSubmit={handleCreateSubmit} className="border-b border-slate-200 bg-indigo-50/50 p-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Create Named Snapshot Checkpoint
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCheckpointName}
                onChange={(e) => setNewCheckpointName(e.target.value)}
                placeholder="e.g. Before restructuring Section 3..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAddCheckpoint(false)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Content View: Snapshot List OR Detailed Snapshot Diff */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedSnapshot ? (
            /* Selected Snapshot Comparison View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to History List
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadSnapshot(selectedSnapshot)}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Download .md
                  </button>

                  <button
                    onClick={() => {
                      onRevertToSnapshot(selectedSnapshot);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Revert to This State
                  </button>
                </div>
              </div>

              {/* Snapshot Info Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>{new Date(selectedSnapshot.timestamp).toLocaleTimeString()} · {new Date(selectedSnapshot.timestamp).toLocaleDateString()}</span>
                  <span className="font-mono text-slate-700">Snapshot ID: {selectedSnapshot.id.slice(0, 8)}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{selectedSnapshot.label}</h3>
                {selectedSnapshot.instruction && (
                  <p className="mt-1 text-xs text-slate-600 italic">
                    Prompt: "{selectedSnapshot.instruction}"
                  </p>
                )}
              </div>

              {/* Diff Mode Selector */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Diff: Snapshot vs Current Active Document
                </span>
                <div className="flex rounded-md bg-slate-100 p-0.5 text-xs">
                  <button
                    onClick={() => setDiffMode('unified')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      diffMode === 'unified' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Unified Diff
                  </button>
                  <button
                    onClick={() => setDiffMode('split')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      diffMode === 'split' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>
              </div>

              {/* Diff Viewer */}
              {diffMode === 'unified' ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 font-mono text-xs leading-relaxed max-h-[460px] overflow-y-auto whitespace-pre-wrap break-words">
                  {snapshotDiffWords.map((part, index) => {
                    if (part.added) {
                      return (
                        <ins
                          key={index}
                          className="bg-emerald-100 text-emerald-800 no-underline px-1 rounded border border-emerald-300 font-medium"
                        >
                          {part.value}
                        </ins>
                      );
                    }
                    if (part.removed) {
                      return (
                        <del
                          key={index}
                          className="bg-red-100 text-red-800 line-through px-1 rounded border border-red-300 opacity-75"
                        >
                          {part.value}
                        </del>
                      );
                    }
                    return <span key={index} className="text-slate-700">{part.value}</span>;
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[460px] overflow-y-auto text-xs font-mono">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 overflow-x-auto">
                    <div className="text-[11px] font-bold text-slate-600 mb-2">Snapshot State</div>
                    <pre className="whitespace-pre-wrap">{selectedSnapshot.content}</pre>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 overflow-x-auto">
                    <div className="text-[11px] font-bold text-indigo-700 mb-2">Current Active State</div>
                    <pre className="whitespace-pre-wrap">{currentContent}</pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* List of All Snapshots */
            <div className="space-y-3">
              {snapshots.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <FileText className="mx-auto h-8 w-8 opacity-40 mb-2" />
                  <p className="text-sm">No snapshots recorded yet.</p>
                </div>
              ) : (
                snapshots.map((snapshot, index) => {
                  const isCurrent = snapshot.content === currentContent;
                  return (
                    <div
                      key={snapshot.id}
                      className={`group rounded-xl border p-4 transition-all hover:shadow-md ${
                        isCurrent
                          ? 'border-indigo-300 bg-indigo-50/30 ring-1 ring-indigo-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold ${
                              snapshot.author === 'ai'
                                ? 'bg-indigo-100 text-indigo-700'
                                : snapshot.author === 'user'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {snapshot.author === 'ai' ? (
                              <Sparkles className="h-3.5 w-3.5" />
                            ) : snapshot.author === 'user' ? (
                              <User className="h-3.5 w-3.5" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {snapshot.label}
                              </span>
                              {isCurrent && (
                                <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                  Current
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                              <span>
                                {new Date(snapshot.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-[11px] text-emerald-700 font-medium">
                                +{snapshot.additions}
                              </span>
                              <span className="font-mono text-[11px] text-red-700 font-medium">
                                -{snapshot.deletions}
                              </span>
                            </div>

                            {snapshot.instruction && (
                              <div className="mt-1 text-xs text-slate-600 italic">
                                Prompt: "{snapshot.instruction}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Snapshot Item Actions */}
                        <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100">
                          <button
                            onClick={() => setSelectedSnapshot(snapshot)}
                            title="Inspect Snapshot Diff"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
                          >
                            <Eye className="h-3 w-3 text-slate-500" />
                            Compare
                          </button>

                          {!isCurrent && (
                            <button
                              onClick={() => {
                                onRevertToSnapshot(snapshot);
                                onClose();
                              }}
                              title="Revert to this snapshot"
                              className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 shadow-2xs"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Revert
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500 flex justify-between items-center">
          <span>{snapshots.length} total snapshots saved in local memory</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
