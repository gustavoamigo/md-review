import React, { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import {
  AlertTriangle,
  Wrench,
  RefreshCw,
  Code2,
  Check,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { extractMermaidCode, cleanDiagramString, formatMermaidMarkdown } from '../utils/mermaidSanitizer';
import { MermaidValidator } from '../utils/MermaidValidator';
import { MermaidErrorContext, MermaidValidationResult } from '../types';

interface MermaidDiagramProps {
  code: string;
  id?: string;
  onAutoRepair?: (brokenCode: string, errorMessage: string, errorContext?: MermaidErrorContext) => Promise<void>;
  isRepairing?: boolean;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  code,
  id = 'diagram',
  onAutoRepair,
  isRepairing = false,
}) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<MermaidErrorContext | null>(null);
  const [validationResult, setValidationResult] = useState<MermaidValidationResult | null>(null);
  const [showRawCode, setShowRawCode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    MermaidValidator.ensureMermaidInitialized();
    let isMounted = true;
    const uniqueId = `mermaid-${id.replace(/[^a-zA-Z0-9_-]/g, '')}-${Math.random().toString(36).substring(2, 9)}`;

    async function renderDiagram() {
      if (!code || !code.trim()) {
        if (isMounted) {
          setError('Empty diagram code');
          setErrorContext(null);
          setValidationResult(null);
        }
        return;
      }

      // 1. Run local pre-validation via MermaidValidator
      const val = await MermaidValidator.validate(code);
      if (!isMounted) return;
      setValidationResult(val);

      if (val.isValid) {
        try {
          const { svg } = await mermaid.render(uniqueId, val.code);
          if (isMounted) {
            setSvgContent(svg);
            setError(null);
            setErrorContext(null);
          }
          return;
        } catch (renderErr: any) {
          console.warn('Mermaid render phase error:', renderErr);
          if (isMounted) {
            setError(renderErr.message || 'Render error');
            setErrorContext(MermaidValidator.extractErrorContext(val.code, renderErr));
            setSvgContent('');
          }
        }
      } else {
        // Validation failed
        setError(val.error || 'Invalid Mermaid syntax');
        setErrorContext(val.errorContext || null);
        setSvgContent('');
      }
    }

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code, id]);

  const handleCopy = () => {
    const textToCopy = validationResult?.code || extractMermaidCode(code);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRepair = async () => {
    if (onAutoRepair && validationResult) {
      await onAutoRepair(
        validationResult.code,
        error || 'Mermaid syntax error',
        errorContext || validationResult.errorContext
      );
    }
  };

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-900 transition-all shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>Mermaid Syntax Error Detected</span>
            {errorContext?.line !== undefined && (
              <span className="rounded-md bg-red-200/80 px-2 py-0.5 text-[11px] font-mono font-bold text-red-800">
                Line {errorContext.line}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 shadow-2xs"
            >
              <HelpCircle className="h-3.5 w-3.5 text-red-500" />
              {showDiagnostics ? 'Hide Diagnostics' : 'Diagnostics'}
              {showDiagnostics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            <button
              onClick={() => setShowRawCode(!showRawCode)}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 shadow-2xs"
            >
              <Code2 className="h-3.5 w-3.5" />
              {showRawCode ? 'Hide Code' : 'View Code'}
            </button>

            {onAutoRepair && (
              <button
                onClick={handleRepair}
                disabled={isRepairing}
                className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-red-800 disabled:opacity-50 transition-colors"
              >
                {isRepairing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isRepairing ? 'Repairing with AI...' : 'Targeted AI Repair'}
              </button>
            )}
          </div>
        </div>

        {/* Clean concise error message */}
        <p className="mt-2.5 font-mono text-xs text-red-800 bg-white/90 p-2.5 rounded-lg border border-red-200 overflow-x-auto">
          {error}
        </p>

        {/* Deep diagnostic information */}
        {showDiagnostics && errorContext && (
          <div className="mt-3 rounded-lg border border-red-200 bg-white p-3 space-y-2.5 text-xs text-slate-800">
            <div className="font-semibold text-red-900 flex items-center justify-between">
              <span>Parser Diagnostic Context:</span>
              {errorContext.offendingToken && (
                <span className="font-mono text-[11px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded">
                  Token: {errorContext.offendingToken}
                </span>
              )}
            </div>

            {errorContext.hints && errorContext.hints.length > 0 && (
              <div className="space-y-1 bg-amber-50/80 p-2.5 rounded-md border border-amber-200 text-amber-900">
                <span className="font-semibold text-[11px] uppercase tracking-wider block text-amber-800">
                  Recommended Fix:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {errorContext.hints.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}

            {errorContext.contextSnippet && (
              <div>
                <span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider block mb-1">
                  Code Snippet Around Failure:
                </span>
                <pre className="p-2.5 rounded-md bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  {errorContext.contextSnippet}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Full raw code viewer */}
        {showRawCode && (
          <div className="mt-3">
            <div className="flex justify-between items-center text-xs text-red-800 mb-1">
              <span className="font-semibold">Raw Diagram Definition:</span>
              <button onClick={handleCopy} className="hover:underline flex items-center gap-1 font-mono text-[11px]">
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : null}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
              {validationResult?.code || extractMermaidCode(code)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative group my-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
      <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowRawCode(!showRawCode)}
          title="Toggle Mermaid Source"
          className="rounded-md border border-slate-200 bg-white p-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs"
        >
          <Code2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleCopy}
          title="Copy Mermaid Code"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs flex items-center gap-1"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : null}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div
        ref={containerRef}
        className="mermaid-wrapper flex justify-center items-center overflow-x-auto py-2"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />

      {showRawCode && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
            Mermaid Definition
          </div>
          <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
            {validationResult?.code || extractMermaidCode(code)}
          </pre>
        </div>
      )}
    </div>
  );
};

