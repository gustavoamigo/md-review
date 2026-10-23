import mermaid from 'mermaid';
import { extractMermaidCode, cleanDiagramString, formatMermaidMarkdown } from './mermaidSanitizer';
import { MermaidErrorContext, MermaidValidationResult } from '../types';

let isMermaidInitialized = false;

/**
 * Initializes Mermaid configuration safely in both browser and Node.js environments
 */
export async function ensureMermaidInitialized(): Promise<void> {
  if (isMermaidInitialized) return;

  // In Node.js environment, DOMPurify needs minimal stubbing so mermaid.parse runs without window
  if (typeof window === 'undefined') {
    try {
      const dompurifyModule = await import('dompurify');
      const dp = dompurifyModule.default || dompurifyModule;
      if (dp && typeof (dp as any).sanitize !== 'function') {
        (dp as any).sanitize = (str: string) => str;
        (dp as any).addHook = () => {};
      }
    } catch {
      // Ignore if dompurify is already loaded
    }
  }

  try {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'neutral',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      suppressErrorRendering: true,
    });
    isMermaidInitialized = true;
  } catch (err: any) {
    console.warn('Mermaid initialization warning:', err.message);
  }
}

/**
 * Infer the high-level diagram type from code
 */
export function inferDiagramType(code: string): string {
  const trimmed = code.trim().toLowerCase();
  if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) return 'flowchart';
  if (trimmed.startsWith('sequencediagram')) return 'sequenceDiagram';
  if (trimmed.startsWith('classdiagram')) return 'classDiagram';
  if (trimmed.startsWith('statediagram')) return 'stateDiagram';
  if (trimmed.startsWith('erdiagram')) return 'erDiagram';
  if (trimmed.startsWith('gantt')) return 'gantt';
  if (trimmed.startsWith('pie')) return 'pie';
  if (trimmed.startsWith('gitgraph')) return 'gitGraph';
  if (trimmed.startsWith('mindmap')) return 'mindmap';
  if (trimmed.startsWith('timeline')) return 'timeline';
  if (trimmed.startsWith('quadrantchart')) return 'quadrantChart';
  return 'unknown';
}

/**
 * Extracts rich, structured error context from a Mermaid parser exception
 */
export function extractErrorContext(code: string, err: any): MermaidErrorContext {
  const rawMessage: string = err?.message || 'Mermaid syntax error';
  const lines = code.split('\n');

  // 1. Extract failing line number
  let lineNum: number | undefined;
  const lineMatch = rawMessage.match(/(?:parse error on|on|at)?\s*line\s*(\d+)/i);
  if (lineMatch) {
    lineNum = parseInt(lineMatch[1], 10);
  } else if (typeof err?.hash?.line === 'number') {
    lineNum = err.hash.line;
  } else if (typeof err?.hash?.loc?.first_line === 'number') {
    lineNum = err.hash.loc.first_line;
  }

  // Adjust for 1-indexed bounds
  if (lineNum !== undefined && lineNum > lines.length) {
    lineNum = lines.length;
  }
  if (lineNum !== undefined && lineNum < 1) {
    lineNum = 1;
  }

  // 2. Extract column number
  const colNum: number | undefined = err?.hash?.loc?.first_column;

  // 3. Extract expected tokens & offending token
  const expected: string[] = Array.isArray(err?.hash?.expected)
    ? err.hash.expected.map((s: string) => s.replace(/^'|'$/g, ''))
    : [];

  const offendingToken: string | undefined = err?.hash?.token;
  const offendingText: string | undefined = err?.hash?.text;

  // 4. Extract offending line content
  let lineContent: string | undefined;
  if (lineNum !== undefined && lineNum >= 1 && lineNum <= lines.length) {
    lineContent = lines[lineNum - 1];
  }

  // 5. Build context snippet with pointer
  let contextSnippet = '';
  if (lineNum !== undefined && lineNum >= 1) {
    const startIdx = Math.max(0, lineNum - 3);
    const endIdx = Math.min(lines.length - 1, lineNum + 2);
    const snippetLines: string[] = [];

    for (let i = startIdx; i <= endIdx; i++) {
      const isTarget = i === lineNum - 1;
      const prefix = isTarget ? '>>> ' : '    ';
      const lineNumStr = `${i + 1}`.padStart(3, ' ');
      snippetLines.push(`${prefix}${lineNumStr} | ${lines[i]}`);
      if (isTarget) {
        const indent = Math.max(0, (colNum || 0) + 9);
        snippetLines.push(`${' '.repeat(indent)}^--- [Error: ${offendingToken || 'Syntax violation'}]`);
      }
    }
    contextSnippet = snippetLines.join('\n');
  }

  // 6. Generate targeted diagnostic fix hints
  const hints = generateDiagnosticHints({
    message: rawMessage,
    line: lineNum,
    column: colNum,
    expected,
    offendingToken,
    offendingText,
    lineContent,
    diagramType: inferDiagramType(code),
  }, lineContent || '');

  // 7. Clean up message for UI presentation (remove verbose ASCII art stack traces from Jison)
  let cleanMessage = rawMessage.split('\n')[0] || rawMessage;
  cleanMessage = cleanMessage.replace(/\.{3,}/g, ' ').replace(/-{3,}\^/g, '').trim();

  return {
    message: cleanMessage,
    line: lineNum,
    column: colNum,
    expected,
    offendingToken,
    offendingText,
    lineContent,
    contextSnippet,
    diagramType: inferDiagramType(code),
    hints,
  };
}

/**
 * Generates actionable diagnostic repair suggestions based on syntax error patterns
 */
export function generateDiagnosticHints(
  context: Partial<MermaidErrorContext>,
  lineContent: string
): string[] {
  const hints: string[] = [];
  const line = lineContent.trim();
  const lowerMsg = (context.message || '').toLowerCase();
  const token = context.offendingToken || '';

  // Case 1: Unquoted parentheses or special characters inside node brackets
  if (
    token === 'PS' ||
    line.includes('(') ||
    /\[[^"\]]*[\(\):;=][^"\]]*\]/.test(line) ||
    /\{[^"\}]*[\(\):;=][^"\}]*\}/.test(line)
  ) {
    hints.push(
      'Node labels with parentheses, colons, or punctuation must be enclosed in double quotes (e.g., A["Label (with details)"] or B{"Decision (Check?)"}).'
    );
  }

  // Case 2: Trailing arrow without target
  if (/(?:-->|---|->>|-->>)\s*$/.test(line)) {
    hints.push(
      'Arrow connection is missing a target node at the end of the line. Complete the connection (e.g., NodeA --> NodeB).'
    );
  }

  // Case 3: Missing colon or malformed sequence diagram message
  if (context.diagramType === 'sequenceDiagram' || line.includes('->>') || line.includes('-->>')) {
    if (!line.includes(':') && (line.includes('->>') || line.includes('-->>'))) {
      hints.push('Sequence diagram messages require a colon before the label (e.g., Alice->>Bob: Hello).');
    }
  }

  // Case 4: Flowchart label pipe syntax
  if (context.expected?.includes('PIPE') || context.expected?.includes("'PIPE'")) {
    hints.push('Flowchart edge text requires matching pipes (e.g., NodeA -->|Edge Label| NodeB).');
  }

  // Case 5: Unclosed square brackets or parentheses
  if (
    context.expected?.includes('SQE') ||
    context.expected?.includes('PE') ||
    context.expected?.includes('TAGEND')
  ) {
    hints.push('Node or tag is unclosed. Ensure all opening brackets `[` or `(` have corresponding closing `]` or `)`.');
  }

  // Case 6: Subgraph without matching end
  if (lowerMsg.includes('subgraph') || line.includes('subgraph')) {
    hints.push('Ensure each `subgraph Title` has a corresponding `end` statement on its own line.');
  }

  // Default fallback hint
  if (hints.length === 0) {
    hints.push('Verify Mermaid keyword spelling, indentation, and ensure node identifiers contain only alphanumeric characters or underscores.');
  }

  return hints;
}

/**
 * Extracts raw Mermaid code from markdown fence or raw text without mutating or auto-sanitizing
 */
export function extractRawMermaidCode(raw: string): string {
  if (!raw) return '';

  const fenceMatch = raw.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1].trim()) {
    return fenceMatch[1].trim();
  }

  const keywordMatch = raw.match(
    /(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|gitGraph|journey|quadrantChart|mindmap|timeline)[\s\S]*/i
  );
  if (keywordMatch && keywordMatch[0].trim()) {
    return keywordMatch[0].replace(/```+.*$/, '').trim();
  }

  return raw.replace(/^```(?:mermaid)?/i, '').replace(/```$/, '').trim();
}

/**
 * Pre-validates a Mermaid diagram using the local mermaid parser.
 * Returns detailed validity status, error context, and auto-sanitization result.
 */
export async function validateMermaid(rawCode: string): Promise<MermaidValidationResult> {
  const code = extractRawMermaidCode(rawCode);

  if (!code || code.trim().length === 0) {
    return {
      isValid: false,
      code: '',
      error: 'Mermaid code is empty',
      errorContext: {
        message: 'Diagram code is empty',
        hints: ['Provide valid Mermaid diagram definition starting with flowchart, sequenceDiagram, etc.'],
      },
    };
  }

  await ensureMermaidInitialized();

  // 1. Try parsing raw code with local library
  try {
    const parseResult = await (mermaid.parse(code) as any);
    const diagramType = parseResult?.diagramType || inferDiagramType(code);

    return {
      isValid: true,
      code,
      diagramType,
    };
  } catch (err: any) {
    const errorContext = extractErrorContext(code, err);

    // 2. Check if local sanitizer can auto-recover this syntax error
    const sanitized = cleanDiagramString(code);
    let canAutoRecoverWithSanitizer = false;

    if (sanitized && sanitized !== code) {
      try {
        await (mermaid.parse(sanitized) as any);
        canAutoRecoverWithSanitizer = true;
      } catch {
        canAutoRecoverWithSanitizer = false;
      }
    }

    return {
      isValid: false,
      code,
      diagramType: errorContext.diagramType,
      error: errorContext.message,
      errorContext,
      sanitizedCode: sanitized,
      canAutoRecoverWithSanitizer,
    };
  }
}

/**
 * Builds a prompt for the AI model incorporating the exact parser error context
 */
export function buildTargetedRepairPrompt(
  code: string,
  errorContext?: MermaidErrorContext,
  customInstruction?: string
): string {
  const diagramType = errorContext?.diagramType || inferDiagramType(code);

  let prompt = `Fix this broken Mermaid ${diagramType} diagram syntax.

The diagram failed validation using the local Mermaid parser with the following diagnostic error context:
`;

  if (errorContext) {
    if (errorContext.line !== undefined) {
      prompt += `- Failing Line: Line ${errorContext.line}\n`;
    }
    prompt += `- Parser Error: ${errorContext.message}\n`;
    if (errorContext.offendingToken) {
      prompt += `- Offending Token: ${errorContext.offendingToken}\n`;
    }
    if (errorContext.expected && errorContext.expected.length > 0) {
      prompt += `- Expected Token Types: ${errorContext.expected.slice(0, 8).join(', ')}\n`;
    }
    if (errorContext.lineContent) {
      prompt += `- Failing Line Content: \`${errorContext.lineContent.trim()}\`\n`;
    }

    if (errorContext.contextSnippet) {
      prompt += `\nError Location Snippet:\n\`\`\`\n${errorContext.contextSnippet}\n\`\`\`\n`;
    }

    if (errorContext.hints && errorContext.hints.length > 0) {
      prompt += `\nDiagnostic Repair Advice:\n${errorContext.hints.map((h) => `• ${h}`).join('\n')}\n`;
    }
  }

  if (customInstruction) {
    prompt += `\nUser's Additional Instruction: "${customInstruction}"\n`;
  }

  prompt += `
Original Broken Mermaid Code:
\`\`\`mermaid
${code}
\`\`\`

Strict Repair Requirements:
1. Return ONLY the repaired Mermaid diagram inside a single \`\`\`mermaid ... \`\`\` code block.
2. The output MUST be 100% syntactically valid Mermaid.
3. Preserve all nodes, labels, data, connections, and meaning from the original diagram.
4. Ensure all labels containing parentheses, braces, quotes, or colons are properly quoted (e.g. Node["Text (with parens)"]).
5. Ensure all arrows have valid source and destination nodes (e.g. A --> B, never dangling A -->).
6. If sequenceDiagram, use proper message format (e.g. ActorA->>ActorB: Message Text).
7. Do not include introductory text, explanations, or markdown outside the single mermaid block.`;

  return prompt;
}

export const MermaidValidator = {
  validate: validateMermaid,
  extractErrorContext,
  generateDiagnosticHints,
  buildTargetedRepairPrompt,
  inferDiagramType,
  ensureMermaidInitialized,
};

export default MermaidValidator;
