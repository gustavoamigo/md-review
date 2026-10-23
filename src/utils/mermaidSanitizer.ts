/**
 * Robust Mermaid syntax extractor, converter, and sanitizer
 * Prevents AI-generated diagrams from breaking due to common syntax pitfalls
 */

export function extractMermaidCode(raw: string): string {
  if (!raw) return '';

  // 1. Try to extract strictly between ```mermaid ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1].trim()) {
    return cleanDiagramString(fenceMatch[1].trim());
  }

  // 2. Try to match from the first known Mermaid keyword to the end
  const keywordMatch = raw.match(
    /(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|gitGraph|journey|quadrantChart|mindmap|timeline)[\s\S]*/i
  );
  if (keywordMatch && keywordMatch[0].trim()) {
    const candidate = keywordMatch[0].replace(/```+.*$/, '').trim();
    return cleanDiagramString(candidate);
  }

  // 3. Fallback: strip leading and trailing backticks
  const cleaned = raw.replace(/^```(?:mermaid)?/i, '').replace(/```$/, '').trim();
  return cleanDiagramString(cleaned);
}

/**
 * Normalizes newlines and fixes common LLM syntax mistakes
 */
export function cleanDiagramString(code: string): string {
  if (!code) return '';

  let normalized = code
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // If sequenceDiagram keyword is glued to statements without newline
  if (normalized.startsWith('sequenceDiagram') && !normalized.startsWith('sequenceDiagram\n')) {
    normalized = normalized.replace(/^sequenceDiagram\s*/i, 'sequenceDiagram\n    ');
  }

  // If flowchart/graph keyword is glued
  if (/^(?:flowchart|graph)\s+[A-Za-z]+[^\n]/i.test(normalized)) {
    normalized = normalized.replace(/^((?:flowchart|graph)\s+[A-Za-z]+)\s*/i, '$1\n    ');
  }

  let lines = normalized.split('\n').map((l) => l.trimEnd());

  // Check if diagram was flattened into a single line or few lines
  if (lines.length <= 3 && (normalized.includes('-->') || normalized.includes('->>'))) {
    const reconstructed = normalized
      .replace(/(subgraph\s+[^\n]+)/gi, '\n$1\n')
      .replace(/\s+(end)(?:\s+|$)/gi, '\n$1\n')
      .replace(/\s+(participant\s+)/gi, '\n    $1')
      .replace(/\s+(actor\s+)/gi, '\n    $1')
      .replace(/\s+(autonumber)(?:\s+|$)/gi, '\n    autonumber\n')
      .replace(/([^\n])\s+([A-Za-z0-9_]+\s*->>)/g, '$1\n    $2')
      .replace(/([^\n])\s+([A-Za-z0-9_]+\s*-->>)/g, '$1\n    $2')
      .replace(/([^\n])\s+([A-Za-z0-9_]+\[[^\]]+\]\s*-->)/g, '$1\n    $2')
      .replace(/([^\n])\s+([A-Za-z0-9_]+\s*-->)/g, '$1\n    $2');
    lines = reconstructed.split('\n').map((l) => l.trimEnd());
  }

  // Sanitize individual lines for common LLM syntax bugs
  const sanitizedLines = lines.map((line) => {
    let l = line;

    // Fix accidental double-double quotes: [""label""] -> ["label"]
    l = l.replace(/\[""+([^"\]]+)""+\]/g, '["$1"]');
    l = l.replace(/\(""([^\)]+)""\)/g, '("$1")');

    // Fix unquoted square brackets containing parentheses or special characters: [Text (with parens)]
    // Only if not already quoted
    if (!l.includes('["') && !l.includes('"]')) {
      l = l.replace(/\[([^"\]\n]*[\(\):;=][^"\]\n]*)\]/g, '["$1"]');
    }

    // Fix unquoted curly braces in decision nodes: {Text (with parens)}
    if (!l.includes('{"') && !l.includes('"}')) {
      l = l.replace(/\{([^"\}\n]*[\(\):;=][^"\}\n]*)\}/g, '{"$1"}');
    }

    // Fix trailing broken arrows: "A -->" at end of line without target
    l = l.replace(/\s*(-->|---|->>)\s*$/, '');

    return l;
  });

  return sanitizedLines.filter((line, idx) => idx === 0 || line.trim() !== '').join('\n').trim();
}

/**
 * Converts a flowchart or graph into an equivalent, valid sequence diagram
 */
export function convertFlowchartToSequenceDiagram(flowchartCode: string): string {
  const clean = extractMermaidCode(flowchartCode);

  // If already a sequence diagram, return cleaned
  if (clean.includes('sequenceDiagram')) {
    return cleanDiagramString(clean);
  }

  const lines = clean.split('\n');
  const participants = new Map<string, string>();
  const messages: Array<{ from: string; to: string; label: string }> = [];

  for (const line of lines) {
    // Extract node definitions: e.g. Client[Edge Clients] or Gateway["API Gateway"]
    const nodeDefs = line.matchAll(/([A-Za-z0-9_]+)\["?([^"\]]+)"?\]/g);
    for (const match of nodeDefs) {
      if (!participants.has(match[1])) {
        const cleanName = match[2].replace(/^["']+|["']+$/g, '').trim();
        participants.set(match[1], cleanName);
      }
    }

    // Extract connections: A -->|Label| B
    const connWithLabel = line.match(/([A-Za-z0-9_]+)\s*-->\|([^|]+)\|\s*([A-Za-z0-9_]+)/);
    if (connWithLabel) {
      const from = connWithLabel[1].trim();
      const to = connWithLabel[3].trim();
      if (!participants.has(from)) participants.set(from, from);
      if (!participants.has(to)) participants.set(to, to);
      const cleanLabel = connWithLabel[2].replace(/^["']+|["']+$/g, '').trim();
      messages.push({
        from,
        to,
        label: cleanLabel,
      });
      continue;
    }

    // Extract connections: A --> B
    const connWithoutLabel = line.match(/([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)/);
    if (connWithoutLabel) {
      const from = connWithoutLabel[1].trim();
      const to = connWithoutLabel[2].trim();
      if (!participants.has(from)) participants.set(from, from);
      if (!participants.has(to)) participants.set(to, to);
      messages.push({
        from,
        to,
        label: 'Calls / Triggers',
      });
    }
  }

  let out = 'sequenceDiagram\n    autonumber\n';
  participants.forEach((label, id) => {
    const safeLabel = label.replace(/^["']+|["']+$/g, '').replace(/"/g, "'").trim();
    out += `    participant ${id} as ${safeLabel}\n`;
  });
  out += '\n';

  for (const msg of messages) {
    const safeLabel = msg.label.replace(/^["']+|["']+$/g, '').replace(/"/g, "'").trim();
    out += `    ${msg.from}->>${msg.to}: ${safeLabel}\n`;
  }

  return cleanDiagramString(out.trim());
}

/**
 * Converts a sequence diagram or any diagram into an equivalent top-down flowchart (flowchart TD)
 */
export function convertSequenceToFlowchart(sequenceCode: string, direction: 'TD' | 'LR' = 'TD'): string {
  const clean = extractMermaidCode(sequenceCode);

  // If already a flowchart or graph, ensure desired direction (e.g. TD)
  if (clean.includes('flowchart') || clean.includes('graph')) {
    const updatedDir = clean.replace(/^(?:flowchart|graph)\s+[A-Za-z]+/m, `flowchart ${direction}`);
    return cleanDiagramString(updatedDir);
  }

  const lines = clean.split('\n');
  const participants = new Map<string, string>();
  const connections: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('autonumber')) continue;

    // Match participant or actor declarations: participant Client as "IoT Edge Device"
    const partMatch = trimmed.match(/(?:participant|actor)\s+([A-Za-z0-9_]+)(?:\s+as\s+([^\n]+))?/i);
    if (partMatch) {
      let rawLabel = (partMatch[2] || partMatch[1]).trim();
      rawLabel = rawLabel.replace(/^["']+|["']+$/g, '').trim();
      participants.set(partMatch[1].trim(), rawLabel);
      continue;
    }

    // Match sequence messages: A ->> B: Label, A ->>+ B: Label, A -->>- B: Label, A -> B: Label, A --> B: Label
    const msgMatch = trimmed.match(/([A-Za-z0-9_]+)\s*(?:->>|-->>|->|-->|-\))[+-]?\s*([A-Za-z0-9_]+)\s*:\s*([^\n]+)/);
    if (msgMatch) {
      const from = msgMatch[1].trim();
      const to = msgMatch[2].trim();
      let label = msgMatch[3].trim().replace(/^["']+|["']+$/g, '').trim();
      // Replace pipes to prevent breaking flowchart syntax
      label = label.replace(/\|/g, '/').replace(/"/g, "'");

      if (!participants.has(from)) participants.set(from, from);
      if (!participants.has(to)) participants.set(to, to);

      connections.push(`    ${from} -->|${label}| ${to}`);
    }
  }

  let out = `flowchart ${direction}\n`;
  participants.forEach((label, id) => {
    const safeLabel = label.replace(/^["']+|["']+$/g, '').replace(/"/g, "'").trim();
    out += `    ${id}["${safeLabel}"]\n`;
  });

  if (connections.length > 0) {
    out += '\n' + connections.join('\n');
  }

  return cleanDiagramString(out.trim());
}

/**
 * Ensures code is cleanly wrapped in standard ```mermaid ... ``` block
 */
export function formatMermaidMarkdown(code: string): string {
  const clean = extractMermaidCode(code);
  return `\`\`\`mermaid\n${clean}\n\`\`\``;
}
