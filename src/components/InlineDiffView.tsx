import React, { useState, useEffect } from 'react';
import * as Diff from 'diff';
import {
  Check,
  X,
  RefreshCw,
  Columns,
  AlignJustify,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Wrench,
  HelpCircle,
} from 'lucide-react';
import { ReviewProposal, MermaidErrorContext, MermaidValidationResult } from '../types';
import { MermaidDiagram } from './MermaidDiagram';
import { extractMermaidCode, formatMermaidMarkdown } from '../utils/mermaidSanitizer';
import { MermaidValidator } from '../utils/MermaidValidator';
import { marked } from 'marked';

interface InlineDiffViewProps {
  proposal: ReviewProposal;
  onAccept: (proposal: ReviewProposal) => void;
  onReject: (proposal: ReviewProposal) => void;
  onRevise: (proposal: ReviewProposal, feedback: string) => Promise<void>;
  onAutoRepairDiagram?: (
    brokenCode: string,
    errorMessage: string,
    errorContext?: MermaidErrorContext
  ) => Promise<void>;
  isRevising?: boolean;
}

export const InlineDiffView: React.FC<InlineDiffViewProps> = ({
  proposal,
  onAccept,
  onReject,
  onRevise,
  onAutoRepairDiagram,
  isRevising = false,
}) => {
  const isDiagram =
    proposal.isDiagram ||
    proposal.originalText.includes('mermaid') ||
    proposal.originalText.includes('flowchart') ||
    proposal.originalText.includes('sequenceDiagram');

  const [viewMode, setViewMode] = useState<'unified' | 'split' | 'preview'>(
    isDiagram ? 'preview' : 'unified'
  );
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [diagramSyntaxError, setDiagramSyntaxError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<MermaidValidationResult | null>(
    proposal.validationResult || null
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isValidatingDiagram, setIsValidatingDiagram] = useState(false);

  // Validate Mermaid syntax using MermaidValidator if this is a diagram
  useEffect(() => {
    if (!isDiagram) return;

    let isMounted = true;

    async function checkSyntax() {
      setIsValidatingDiagram(true);
      try {
        const res = await MermaidValidator.validate(proposal.suggestedText);
        if (isMounted) {
          setValidationResult(res);
          setDiagramSyntaxError(res.isValid ? null : (res.error || 'Syntax error'));
        }
      } catch (err: any) {
        if (isMounted) {
          setDiagramSyntaxError(err.message || 'Syntax error in Mermaid definition');
        }
      } finally {
        if (isMounted) setIsValidatingDiagram(false);
      }
    }

    checkSyntax();
    return () => {
      isMounted = false;
    };
  }, [isDiagram, proposal.suggestedText]);

  // Compute word-level diffs
  const diffWords = Diff.diffWordsWithSpace(proposal.originalText, proposal.suggestedText);

  // Compute line-level diffs for statistics
  const diffLines = Diff.diffLines(proposal.originalText, proposal.suggestedText);
  let additionsCount = 0;
  let deletionsCount = 0;
  diffLines.forEach((part) => {
    if (part.added) additionsCount += part.count || 1;
    if (part.removed) deletionsCount += part.count || 1;
  });

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || isRevising) return;
    await onRevise(proposal, feedbackText.trim());
    setFeedbackText('');
    setShowFeedbackInput(false);
  };

  const handleRepairClick = async () => {
    if (onAutoRepairDiagram && (validationResult || diagramSyntaxError)) {
      const codeToFix = validationResult?.code || extractMermaidCode(proposal.suggestedText);
      await onAutoRepairDiagram(
        codeToFix,
        diagramSyntaxError || 'Mermaid syntax error',
        validationResult?.errorContext
      );
    }
  };

  return (
    <div className="my-4 rounded-xl border border-indigo-200 bg-white shadow-md overflow-hidden transition-all ring-2 ring-indigo-500/10">
      {/* Diff Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600 text-white shadow-2xs">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="text-xs font-semibold text-indigo-950">
            {isDiagram ? 'AI Proposed Diagram Edit: ' : 'AI Proposed Edit: '}
            <span className="font-normal italic text-indigo-800">"{proposal.instruction}"</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 font-mono text-[11px] font-medium">
            <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">+{additionsCount}</span>
            <span className="text-red-700 bg-red-100/80 px-1.5 py-0.5 rounded">-{deletionsCount}</span>
          </div>

          <div className="h-3.5 w-[1px] bg-indigo-200" />

          {/* View Mode Toggle */}
          <div className="flex rounded-md bg-white p-0.5 border border-indigo-200 text-indigo-700">
            <button
              onClick={() => setViewMode('preview')}
              title={isDiagram ? 'Live Diagram Visual Preview' : 'Rendered Markdown Preview'}
              className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium transition-colors ${
                viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50'
              }`}
            >
              <Eye className="h-3 w-3" />
              {isDiagram ? 'Live Diagram' : 'Preview'}
            </button>
            <button
              onClick={() => setViewMode('unified')}
              title="Unified Inline Diff"
              className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium transition-colors ${
                viewMode === 'unified' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50'
              }`}
            >
              <AlignJustify className="h-3 w-3" />
              Unified
            </button>
            <button
              onClick={() => setViewMode('split')}
              title="Side-by-Side Comparison"
              className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium transition-colors ${
                viewMode === 'split' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50'
              }`}
            >
              <Columns className="h-3 w-3" />
              Split
            </button>
          </div>
        </div>
      </div>

      {/* Mermaid Diagram Pre-Accept Validation Banner */}
      {isDiagram && (
        <div className="border-b border-slate-200">
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs transition-colors ${
              diagramSyntaxError
                ? 'bg-red-50 text-red-900 border-b border-red-100'
                : 'bg-emerald-50/70 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {diagramSyntaxError ? (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              )}
              <span className="font-semibold">
                {diagramSyntaxError ? (
                  <>
                    <span>Syntax Error Detected</span>
                    {validationResult?.errorContext?.line !== undefined && (
                      <span className="ml-1.5 rounded bg-red-200/80 px-1.5 py-0.5 font-mono text-[11px] text-red-800">
                        Line {validationResult.errorContext.line}
                      </span>
                    )}
                    <span className="font-normal ml-1.5 text-red-800 truncate max-w-md inline-block align-bottom">
                      : {validationResult?.errorContext?.message || diagramSyntaxError}
                    </span>
                  </>
                ) : (
                  <span>
                    Mermaid syntax pre-validated &amp; valid
                    {validationResult?.diagramType ? ` (${validationResult.diagramType})` : ''}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {diagramSyntaxError && (
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="rounded border border-red-300 bg-white px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50 shadow-2xs"
                >
                  {showDiagnostics ? 'Hide Diagnostics' : 'Inspect Error'}
                </button>
              )}

              {diagramSyntaxError && onAutoRepairDiagram && (
                <button
                  onClick={handleRepairClick}
                  disabled={isRevising}
                  className="inline-flex items-center gap-1.5 rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-red-800 disabled:opacity-50 transition-colors"
                >
                  {isRevising ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {isRevising
                    ? 'Repairing...'
                    : validationResult?.errorContext?.line !== undefined
                    ? `Targeted Fix (Line ${validationResult.errorContext.line})`
                    : 'Targeted Fix with AI'}
                </button>
              )}
            </div>
          </div>

          {/* Diagnostic Context in Diff Banner */}
          {diagramSyntaxError && showDiagnostics && validationResult?.errorContext && (
            <div className="bg-red-50/50 p-3 border-t border-red-200 text-xs text-red-950 space-y-2">
              {validationResult.errorContext.hints && validationResult.errorContext.hints.length > 0 && (
                <div className="bg-white/80 p-2 rounded border border-red-200 space-y-1">
                  <span className="font-semibold text-red-900 block text-[11px] uppercase tracking-wider">
                    Diagnostic Guidance:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-700 text-[11px]">
                    {validationResult.errorContext.hints.map((hint, idx) => (
                      <li key={idx}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.errorContext.contextSnippet && (
                <div>
                  <span className="font-semibold text-slate-600 block text-[11px] uppercase tracking-wider mb-1">
                    Offending Line Snippet:
                  </span>
                  <pre className="p-2.5 rounded bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                    {validationResult.errorContext.contextSnippet}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Diff Content Viewport */}
      <div className="p-4 text-sm font-mono leading-relaxed bg-slate-50/50 max-h-[500px] overflow-y-auto">
        {viewMode === 'preview' ? (
          isDiagram ? (
            /* Live Rendered Diagram Preview */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-sans text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">Proposed Diagram Visual Rendering:</span>
                <span>Checked before accept</span>
              </div>
              <MermaidDiagram
                code={proposal.suggestedText}
                id={`preview-${proposal.id}`}
                onAutoRepair={async (brokenCode, err, ctx) => {
                  if (onAutoRepairDiagram) {
                    await onAutoRepairDiagram(brokenCode, err, ctx);
                  }
                }}
                isRepairing={isRevising}
              />
            </div>
          ) : (
            /* Rendered Markdown Preview with formatted links */
            <div className="space-y-2 font-sans">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">Rendered Markdown Preview:</span>
                <span className="text-[11px] text-indigo-600 font-medium">Clickable links & formatted markdown</span>
              </div>
              <div
                className="rounded-lg border border-slate-200 bg-white p-4 text-slate-800 text-sm leading-relaxed markdown-preview"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(proposal.suggestedText) as string,
                }}
              />
            </div>
          )
        ) : viewMode === 'unified' ? (
          <div className="whitespace-pre-wrap break-words rounded-lg border border-slate-200/80 bg-white p-3.5">
            {diffWords.map((part, index) => {
              if (part.added) {
                return (
                  <ins
                    key={index}
                    className="diff-ins no-underline inline-block rounded px-1 my-0.5 text-emerald-900 bg-emerald-100 border border-emerald-300 font-medium"
                  >
                    {part.value}
                  </ins>
                );
              }
              if (part.removed) {
                return (
                  <del
                    key={index}
                    className="diff-del inline-block rounded px-1 my-0.5 text-red-800 bg-red-100 border border-red-300 line-through opacity-80"
                  >
                    {part.value}
                  </del>
                );
              }
              return (
                <span key={index} className="text-slate-700">
                  {part.value}
                </span>
              );
            })}
          </div>
        ) : (
          /* Split View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-1.5 flex items-center justify-between">
                <span>Original</span>
                <span className="text-[10px] font-normal text-red-500">To be replaced</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs text-slate-800">
                {proposal.originalText}
              </pre>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5 flex items-center justify-between">
                <span>Proposed Rewrite</span>
                <span className="text-[10px] font-normal text-emerald-500">AI suggestion</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs text-slate-900">
                {proposal.suggestedText}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Revision History If Thread Exists */}
      {proposal.feedbackThread.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-2 text-xs">
          <div className="font-semibold text-slate-700 mb-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-slate-500" />
            Revision Thread ({proposal.feedbackThread.length}):
          </div>
          <div className="space-y-1.5 pl-4 border-l-2 border-slate-300">
            {proposal.feedbackThread.map((item, idx) => (
              <div key={idx} className="text-slate-600">
                <span className="font-medium text-slate-800">Turn {idx + 1}:</span> {item.feedback || item.instruction}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Revision Popover Input */}
      {showFeedbackInput && (
        <form onSubmit={handleReviseSubmit} className="border-t border-indigo-100 bg-indigo-50/60 p-3">
          <label className="block text-xs font-semibold text-indigo-950 mb-1">
            What should be revised in this suggestion?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={
                isDiagram
                  ? 'e.g., "Add an auth check between Client and Gateway", "Keep node labels shorter"...'
                  : 'e.g., "Keep the bullet points", "Make it even shorter"...'
              }
              className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={isRevising || !feedbackText.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isRevising ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {isRevising ? 'Revising...' : 'Ask Again'}
            </button>
            <button
              type="button"
              onClick={() => setShowFeedbackInput(false)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>

          {/* Quick 1-click Revision Suggestions */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-indigo-900 mr-1">Quick revise:</span>
            {(isDiagram
              ? [
                  'Change to a top down diagram',
                  'Change to a sequence diagram',
                  'Convert to flowchart LR',
                  'Add cache bypass branch',
                  'Shorten node labels',
                ]
              : [
                  'Make it even shorter',
                  'Keep bullet point structure',
                  'Make tone more technical',
                  'Add code example',
                ]
            ).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={isRevising}
                onClick={async () => {
                  await onRevise(proposal, suggestion);
                  setShowFeedbackInput(false);
                }}
                className="rounded-md border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-2xs"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="text-xs text-slate-500">
          {diagramSyntaxError
            ? '⚠️ Please repair syntax before accepting'
            : 'Review diff before committing to file'}
        </div>

        <div className="flex items-center gap-2">
          {/* Revise Button */}
          <button
            onClick={() => setShowFeedbackInput(!showFeedbackInput)}
            disabled={isRevising}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isRevising ? 'animate-spin' : ''}`} />
            Revise
          </button>

          {/* Discard Button */}
          <button
            onClick={() => onReject(proposal)}
            disabled={isRevising}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-2xs hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-red-500" />
            Discard
          </button>

          {/* Accept Button */}
          <button
            onClick={() => onAccept(proposal)}
            disabled={isRevising || Boolean(diagramSyntaxError)}
            title={diagramSyntaxError ? 'Cannot accept while diagram has syntax errors' : 'Accept & Save'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            Accept &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
};
