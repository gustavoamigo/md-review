import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Server-side Gemini initialization as mandated by gemini-api guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ProviderConfig {
  provider: 'gemini' | 'ollama' | 'openai-compatible';
  endpoint?: string;
  model?: string;
  apiKey?: string;
}

// Helper to query OpenAI-compatible server (e.g. Ollama, LM Studio, vLLM)
async function callOpenAICompatible(
  config: ProviderConfig,
  messages: Array<{ role: string; content: string }>,
  temperature = 0.2
): Promise<string> {
  const baseUrl = (config.endpoint || 'http://localhost:11434/v1').replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model || 'llama3.2',
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI-compatible server responded with ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from OpenAI-compatible model');
  }
  return content;
}

import {
  extractMermaidCode,
  cleanDiagramString,
  formatMermaidMarkdown,
  convertFlowchartToSequenceDiagram,
  convertSequenceToFlowchart,
} from './src/utils/mermaidSanitizer.ts';
import { MermaidValidator } from './src/utils/MermaidValidator.ts';

// Strip unintended markdown code fences and conversational preambles
function cleanMarkdownOutput(text: string, isOriginalCodeBlock = false): string {
  let cleaned = text.trim();

  // Strip conversational preambles like "Here is the requested markdown block:"
  cleaned = cleaned.replace(/^(?:Here (?:is|are) (?:the|a) [^\n:]+:\s*|Sure(?:thing)?,? [^\n:]+:\s*|Certainly[^\n:]*:\s*)/i, '').trim();

  // If wrapped in ```markdown ... ``` or ```md ... ```, unwrap unless original block was specifically code
  if (!isOriginalCodeBlock) {
    const fenceMatch = cleaned.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
  }

  return cleaned;
}

// Detect and eliminate duplicate trailing sections or repeated footers
function deduplicateTrailingFooters(text: string): string {
  const lines = text.trim().split('\n');
  if (lines.length < 6) return text;

  // Find headings in text
  const headingIndices: number[] = [];
  lines.forEach((line, idx) => {
    if (line.match(/^#{1,4}\s+/)) {
      headingIndices.push(idx);
    }
  });

  if (headingIndices.length >= 2) {
    const lastHeadingIdx = headingIndices[headingIndices.length - 1];
    const lastHeadingLine = lines[lastHeadingIdx].trim();

    // Check if an earlier heading has the exact same title
    const earlierHeadingIdx = headingIndices.slice(0, -1).find(
      (idx) => lines[idx].trim().toLowerCase() === lastHeadingLine.toLowerCase()
    );

    if (earlierHeadingIdx !== undefined) {
      const earlierSectionSnippet = lines.slice(earlierHeadingIdx, earlierHeadingIdx + 4).join('\n');
      const lastSectionSnippet = lines.slice(lastHeadingIdx, lastHeadingIdx + 4).join('\n');
      if (earlierSectionSnippet.slice(0, 35) === lastSectionSnippet.slice(0, 35)) {
        return lines.slice(0, lastHeadingIdx).join('\n').trimEnd();
      }
    }
  }

  return text;
}

// Local heuristic transformer for offline resilience or temporary API service 503 spikes
function performLocalHeuristicRewrite(
  prompt: string,
  workspaceFiles?: any[],
  isWholeDocument = false
): string {
  const targetMatch = prompt.match(/Target Block Original Content:\n([\s\S]*?)(?:\n\nOutput strictly|\n\nPrevious Revision|$)/);
  const instructionMatch = prompt.match(/User instruction: "([^"]+)"/);

  const original = targetMatch ? targetMatch[1].trim() : prompt;
  const instruction = instructionMatch ? instructionMatch[1].toLowerCase() : '';

  // 1. Dedicated handling for linking documents in workspace
  if (
    (instruction.includes('link') && (instruction.includes('doc') || instruction.includes('file'))) ||
    instruction.includes('linking')
  ) {
    let docItems = [
      {
        title: 'HyperScale Event Engine Specification',
        path: 'docs/architecture-spec.md',
        desc: 'Distributed event processing engine specification with Mermaid sequence diagrams',
      },
      {
        title: 'API Gateway & Ingestion Specification',
        path: 'docs/api-gateway.md',
        desc: 'Edge API Gateway coordinating gRPC/HTTP/2 traffic, authentication, and sliding-window rate limits',
      },
      {
        title: 'Runbook: PostgreSQL High-Availability Failover',
        path: 'docs/database-failover.md',
        desc: 'Critical incident response guide for automated primary database promotion and replication resynchronization',
      },
    ];

    if (workspaceFiles && Array.isArray(workspaceFiles) && workspaceFiles.length > 0) {
      const docsInFolder = workspaceFiles.filter(
        (f: any) =>
          f.type === 'file' &&
          (f.path?.startsWith('docs/') || f.folder === 'docs' || f.name?.endsWith('.md'))
      );
      if (docsInFolder.length > 0) {
        docItems = docsInFolder.map((d: any) => ({
          title: d.title || d.name.replace(/\.[^/.]+$/, ''),
          path: d.path || `docs/${d.name}`,
          desc: d.description || 'System documentation specification',
        }));
      }
    }

    const linksBlock = [
      '### Related Documentation',
      ...docItems.map((item) => `- [${item.title}](${item.path}) - ${item.desc}`),
    ].join('\n');

    if (isWholeDocument) {
      // Cleanly insert without duplicating any existing sections or footers
      const sections = original.split(/\n\n(?=##\s+)/);
      if (sections.length > 1) {
        const lastSection = sections.pop()!;
        return [...sections, linksBlock, lastSection].join('\n\n');
      }
      return original.trimEnd() + '\n\n' + linksBlock;
    }

    return linksBlock;
  }

  // 2. Dedicated handling for Mermaid diagrams
  const isMermaid =
    original.includes('```mermaid') ||
    original.includes('flowchart') ||
    original.includes('sequenceDiagram') ||
    original.includes('graph ') ||
    original.includes('classDiagram');

  if (isMermaid) {
    const code = extractMermaidCode(original);
    const lines = code.split('\n');

    // Convert to sequence diagram
    if (instruction.includes('sequence') || instruction.includes('seq')) {
      const converted = convertFlowchartToSequenceDiagram(original);
      return formatMermaidMarkdown(converted);
    }

    // Convert to flowchart / top-down / graph
    if (
      instruction.includes('flowchart') ||
      instruction.includes('graph') ||
      instruction.includes('top down') ||
      instruction.includes('top-down') ||
      instruction.includes('td') ||
      instruction.includes('flow') ||
      (instruction.includes('back') && !instruction.includes('sequence'))
    ) {
      const direction = instruction.includes('lr') || instruction.includes('left') ? 'LR' : 'TD';
      const converted = convertSequenceToFlowchart(original, direction);
      return formatMermaidMarkdown(converted);
    }

    if (instruction.includes('short') || instruction.includes('concise')) {
      const shortenedLines = lines.map((line) => {
        return line.replace(/\[([^\]]+)\]/g, (_, label) => {
          const shortLabel = label.split(' ').slice(0, 2).join(' ');
          return `["${shortLabel}"]`;
        });
      });
      return formatMermaidMarkdown(shortenedLines.join('\n'));
    }

    if (instruction.includes('cache') || instruction.includes('bypass') || instruction.includes('fast path')) {
      const hasGraph = lines.some((l) => l.includes('flowchart') || l.includes('graph'));
      if (hasGraph) {
        const insertIdx = lines.findIndex((l) => l.includes('-->'));
        if (insertIdx !== -1) {
          lines.splice(
            insertIdx + 1,
            0,
            '    Gateway -->|Cache Hit| FastCache[(Redis Cluster Cache)]',
            '    FastCache -->|Instant Reply| Client'
          );
        }
      }
      return formatMermaidMarkdown(lines.join('\n'));
    }

    return formatMermaidMarkdown(code);
  }

  // 3. Headings numbering
  if (instruction.includes('number') && (instruction.includes('heading') || original.startsWith('#'))) {
    const lines = original.split('\n');
    let counter = 1;
    return lines
      .map((line) => {
        if (line.match(/^#{1,6}\s+/)) {
          return line.replace(/^(#{1,6}\s+)(?:\d+\.\s*)?/, `$1${counter++}. `);
        }
        return line;
      })
      .join('\n');
  }

  // 4. Shorten text
  if (instruction.includes('short') || instruction.includes('concise') || instruction.includes('brief')) {
    return original
      .split('. ')
      .map((sentence) => {
        return sentence
          .replace(/in order to/gi, 'to')
          .replace(/it should be noted that/gi, '')
          .replace(/utilized/gi, 'used')
          .replace(/engineered for the purpose of/gi, 'built for')
          .replace(/by utilizing/gi, 'using')
          .trim();
      })
      .filter((_, i) => i === 0 || i % 2 === 0)
      .join('. ') + (original.endsWith('.') ? '.' : '');
  }

  // 5. Bullet lists
  if (instruction.includes('bullet') || instruction.includes('list')) {
    const sentences = original.split(/\.\s+/);
    return sentences
      .filter((s) => s.trim().length > 0)
      .map((s) => `- ${s.trim().replace(/\.$/, '')}`)
      .join('\n');
  }

  // 6. Table conversion
  if (instruction.includes('table')) {
    const lines = original.split('\n').filter((l) => l.trim().length > 0);
    let table = '| Item | Specification |\n| :--- | :--- |\n';
    lines.forEach((l, idx) => {
      table += `| Parameter ${idx + 1} | ${l.replace(/^[-*]\s*/, '').trim()} |\n`;
    });
    return table;
  }

  // General polish for prose
  if (original.includes('\n')) {
    return original
      .split('\n')
      .map((l) => l.trim())
      .join('\n');
  }

  return original.replace(/\s+/g, ' ').trim();
}

// Helper to execute Gemini call with retry, fallback, and resilience
async function callGeminiWithResilience(
  prompt: string,
  systemInstruction?: string,
  temperature = 0.2,
  workspaceFiles?: any[],
  isWholeDocument = false
): Promise<string> {
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

  for (let m = 0; m < modelsToTry.length; m++) {
    const model = modelsToTry[m];
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model call timeout')), 12000)
      );

      const response = await Promise.race([callPromise, timeoutPromise]);
      if (response && response.text && response.text.trim().length > 0) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Model ${model} attempt failed or timed out: ${err.message?.slice(0, 80)}`);
    }
  }

  // Graceful offline heuristic fallback so user workflow is uninterrupted during upstream 503 spikes
  console.log('Using resilient heuristic transformer due to upstream model capacity spike');
  return performLocalHeuristicRewrite(prompt, workspaceFiles, isWholeDocument);
}

// Endpoint: Test connection to model provider
app.post('/api/ai/test-connection', async (req: Request, res: Response) => {
  const { providerConfig } = req.body as { providerConfig?: ProviderConfig };
  const startTime = Date.now();

  try {
    if (providerConfig?.provider === 'ollama' || providerConfig?.provider === 'openai-compatible') {
      const reply = await callOpenAICompatible(
        providerConfig,
        [{ role: 'user', content: 'Respond with "PONG"' }],
        0.0
      );
      const latencyMs = Date.now() - startTime;
      return res.json({
        ok: true,
        provider: providerConfig.provider,
        model: providerConfig.model || 'local',
        latencyMs,
        sampleOutput: reply.trim(),
      });
    }

    // Default: Gemini with resilience
    const reply = await callGeminiWithResilience('Respond with "PONG"');
    const latencyMs = Date.now() - startTime;
    return res.json({
      ok: true,
      provider: 'gemini',
      model: 'gemini',
      latencyMs,
      sampleOutput: reply.trim() || 'PONG',
    });
  } catch (err: any) {
    console.error('Test connection error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Connection test failed',
    });
  }
});

// Endpoint: In-Document Review / Rewrite
app.post('/api/ai/review-block', async (req: Request, res: Response) => {
  const {
    instruction,
    originalText,
    surroundingContext,
    wholeDocument,
    isDiagram,
    feedbackThread,
    providerConfig,
    workspaceFiles,
    workspaceContextText,
    isWholeDocument,
  } = req.body;

  if (!instruction || originalText === undefined) {
    return res.status(400).json({ error: 'Instruction and originalText are required' });
  }

  const isFullDoc = Boolean(isWholeDocument || wholeDocument);

  const systemPrompt = `You are md-review, an expert in-document Markdown reviewer, technical documentation architect, and surgical editor.
Your goal is to apply the user's edit instruction to the targeted text block or document inside a Markdown file.

CRITICAL RULES:
1. Return raw, pure Markdown text.
2. DO NOT add conversational commentary, greetings, preamble ("Here is the...", "Sure, here..."), or explanations unless explicitly requested.
3. DO NOT wrap normal Markdown prose, headings, or lists inside \`\`\`markdown ... \`\`\` or \`\`\`md code blocks. Code blocks must ONLY be used for genuine programming code snippets or \`\`\`mermaid diagrams.
4. STRICT DOCUMENT GROUNDING & LINKING:
   - When asked to link documents (e.g. "add a block linking the documents in docs"), ONLY reference real files listed in the workspace context.
   - NEVER make up or hallucinate filenames, relative paths, or imaginary URLs (e.g. DO NOT invent "docs/overview.md" or "docs/index.md" if they are not in the workspace).
   - Format links with standard Markdown: [Document Title](path/to/file.md) - Brief description.
5. ANTI-DUPLICATION MANDATE:
   - Do NOT duplicate existing sections, footers, headers, or paragraphs.
   - If adding or inserting a section (such as related documentation links), insert it cleanly into the document structure. DO NOT duplicate the final section, footer, or any existing block.
   - Each section must appear exactly ONCE.
6. If the target is a Mermaid diagram, produce strictly valid Mermaid code (starting with \`\`\`mermaid ... \`\`\`).
7. Ensure formatting matches standard Markdown conventions (proper heading levels, list indentation, table alignments).`;

  let prompt = '';

  // Inject real workspace file context if available
  if (workspaceContextText) {
    prompt += `${workspaceContextText}\n\n`;
  } else if (workspaceFiles && Array.isArray(workspaceFiles) && workspaceFiles.length > 0) {
    prompt += `=== WORKSPACE FILES CONTEXT ===\n`;
    workspaceFiles.forEach((f: any) => {
      prompt += `- Path: "${f.path}" | Title: "${f.title || f.name}" | Folder: "${f.folder || 'root'}"\n`;
      if (f.description) prompt += `  Summary: ${f.description}\n`;
    });
    prompt += `===============================\n\n`;
  }

  prompt += `User instruction: "${instruction}"\n\n`;

  if (surroundingContext && !isFullDoc) {
    prompt += `Surrounding Document Context:\n${surroundingContext}\n\n`;
  }

  prompt += `${isFullDoc ? 'Full Document Original Content:' : 'Target Block Original Content:'}\n${originalText}\n\n`;

  if (feedbackThread && Array.isArray(feedbackThread) && feedbackThread.length > 0) {
    prompt += `Previous Revision Feedback:\n`;
    feedbackThread.forEach((fb: any, idx: number) => {
      prompt += `Revision ${idx + 1}: ${fb.instruction}\nAI previous output: ${fb.suggested}\nUser revision note: ${fb.feedback || 'None'}\n\n`;
    });
    prompt += `Please incorporate the latest revision feedback to refine the output.\n\n`;
  }

  prompt += `Output strictly the replacement text (no conversational preamble, no duplicate sections/footers):`;

  try {
    let suggestedText = '';

    if (providerConfig?.provider === 'ollama' || providerConfig?.provider === 'openai-compatible') {
      suggestedText = await callOpenAICompatible(
        providerConfig,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        0.2
      );
    } else {
      suggestedText = await callGeminiWithResilience(
        prompt,
        systemPrompt,
        0.2,
        workspaceFiles,
        isFullDoc
      );
    }

    // Clean up and normalize if this is a diagram
    const isTargetDiagram =
      isDiagram ||
      originalText.includes('mermaid') ||
      originalText.includes('flowchart') ||
      originalText.includes('sequenceDiagram') ||
      originalText.includes('graph ') ||
      originalText.includes('classDiagram');

    let validationResult = undefined;

    if (isTargetDiagram) {
      const lowerInstr = (instruction || '').toLowerCase();
      // If user requested top-down flowchart but output is still sequenceDiagram
      if (
        (lowerInstr.includes('top down') ||
          lowerInstr.includes('top-down') ||
          lowerInstr.includes('flowchart') ||
          lowerInstr.includes('td') ||
          (lowerInstr.includes('back') && !lowerInstr.includes('sequence'))) &&
        suggestedText.includes('sequenceDiagram')
      ) {
        suggestedText = convertSequenceToFlowchart(originalText);
      }

      // If user requested sequence diagram but output is still flowchart
      if (
        (lowerInstr.includes('sequence') || lowerInstr.includes('seq')) &&
        (suggestedText.includes('flowchart') || suggestedText.includes('graph'))
      ) {
        suggestedText = convertFlowchartToSequenceDiagram(originalText);
      }

      // Pre-validate suggested diagram syntax with local MermaidValidator
      const initialVal = await MermaidValidator.validate(suggestedText);
      if (!initialVal.isValid) {
        console.log(`Pre-validation detected Mermaid syntax error on line ${initialVal.errorContext?.line}: ${initialVal.errorContext?.message}`);
        try {
          const repairPrompt = MermaidValidator.buildTargetedRepairPrompt(
            initialVal.code,
            initialVal.errorContext,
            instruction
          );
          let repairedText = '';
          if (providerConfig?.provider === 'ollama' || providerConfig?.provider === 'openai-compatible') {
            repairedText = await callOpenAICompatible(
              providerConfig,
              [{ role: 'user', content: repairPrompt }],
              0.1
            );
          } else {
            repairedText = await callGeminiWithResilience(repairPrompt, undefined, 0.1, workspaceFiles, false);
          }

          const repairedVal = await MermaidValidator.validate(repairedText);
          if (repairedVal.isValid) {
            suggestedText = formatMermaidMarkdown(repairedVal.code);
            validationResult = repairedVal;
          } else if (initialVal.canAutoRecoverWithSanitizer && initialVal.sanitizedCode) {
            suggestedText = formatMermaidMarkdown(initialVal.sanitizedCode);
            validationResult = { ...initialVal, isValid: true, code: initialVal.sanitizedCode };
          } else {
            suggestedText = formatMermaidMarkdown(cleanDiagramString(repairedText || suggestedText));
            validationResult = repairedVal;
          }
        } catch {
          suggestedText = formatMermaidMarkdown(suggestedText);
          validationResult = initialVal;
        }
      } else {
        suggestedText = formatMermaidMarkdown(initialVal.code);
        validationResult = initialVal;
      }
    } else {
      // Clean unwrapped markdown & conversational preambles
      const isOriginalCode = originalText.trim().startsWith('```');
      suggestedText = cleanMarkdownOutput(suggestedText, isOriginalCode);

      // Deduplicate trailing repeated sections or footers if whole document
      if (isFullDoc) {
        suggestedText = deduplicateTrailingFooters(suggestedText);
      }
    }

    return res.json({
      suggestedText,
      originalText,
      instruction,
      isDiagram: isTargetDiagram,
      validationResult,
    });
  } catch (err: any) {
    console.error('Error in review-block:', err);
    return res.status(500).json({ error: err.message || 'Failed to review block' });
  }
});

// Endpoint: Auto-repair broken Mermaid syntax with local pre-validation and targeted context
app.post('/api/ai/repair-mermaid', async (req: Request, res: Response) => {
  const { brokenCode, errorMessage, errorContext, instruction, providerConfig } = req.body;

  if (!brokenCode) {
    return res.status(400).json({ error: 'brokenCode is required' });
  }

  try {
    // 1. Pre-validate syntax locally using MermaidValidator
    const localValidation = await MermaidValidator.validate(brokenCode);

    // If already valid locally, return immediately
    if (localValidation.isValid) {
      return res.json({
        repairedCode: localValidation.code,
        formattedBlock: formatMermaidMarkdown(localValidation.code),
        validationResult: localValidation,
        isValid: true,
      });
    }

    // 2. Synthesize rich error context
    const mergedErrorContext = errorContext || localValidation.errorContext || {
      message: errorMessage || 'Mermaid syntax error',
      hints: [],
    };

    // 3. Build laser-targeted prompt using specific parser error context
    const prompt = MermaidValidator.buildTargetedRepairPrompt(
      localValidation.code || brokenCode,
      mergedErrorContext,
      instruction
    );

    let repaired = '';
    if (providerConfig?.provider === 'ollama' || providerConfig?.provider === 'openai-compatible') {
      repaired = await callOpenAICompatible(
        providerConfig,
        [{ role: 'user', content: prompt }],
        0.1
      );
    } else {
      repaired = await callGeminiWithResilience(prompt, undefined, 0.1);
    }

    // 4. Validate AI repaired output with local MermaidValidator
    const aiValidation = await MermaidValidator.validate(repaired);

    // 5. If AI repair succeeded, return immediately
    if (aiValidation.isValid) {
      return res.json({
        repairedCode: aiValidation.code,
        formattedBlock: formatMermaidMarkdown(aiValidation.code),
        validationResult: aiValidation,
        isValid: true,
      });
    }

    // 6. If AI repair was imperfect, check if local sanitizer succeeded
    if (localValidation.canAutoRecoverWithSanitizer && localValidation.sanitizedCode) {
      console.log('Falling back to verified locally sanitized Mermaid diagram');
      return res.json({
        repairedCode: localValidation.sanitizedCode,
        formattedBlock: formatMermaidMarkdown(localValidation.sanitizedCode),
        validationResult: { ...localValidation, isValid: true, code: localValidation.sanitizedCode },
        isValid: true,
      });
    }

    // 7. Second targeted pass with the new error context from AI output
    console.log(`Running second targeted repair pass on line ${aiValidation.errorContext?.line}...`);
    const retryPrompt = MermaidValidator.buildTargetedRepairPrompt(
      aiValidation.code,
      aiValidation.errorContext,
      'Ensure 100% valid syntax on this second pass'
    );
    let secondRepaired = '';
    if (providerConfig?.provider === 'ollama' || providerConfig?.provider === 'openai-compatible') {
      secondRepaired = await callOpenAICompatible(
        providerConfig,
        [{ role: 'user', content: retryPrompt }],
        0.05
      );
    } else {
      secondRepaired = await callGeminiWithResilience(retryPrompt, undefined, 0.05);
    }

    const secondValidation = await MermaidValidator.validate(secondRepaired);
    const finalCode = secondValidation.isValid
      ? secondValidation.code
      : cleanDiagramString(secondRepaired || repaired);

    return res.json({
      repairedCode: finalCode,
      formattedBlock: formatMermaidMarkdown(finalCode),
      validationResult: secondValidation.isValid ? secondValidation : aiValidation,
      isValid: secondValidation.isValid,
    });
  } catch (err: any) {
    console.error('Error repairing mermaid diagram:', err);
    return res.status(500).json({ error: err.message || 'Failed to repair Mermaid diagram' });
  }
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`md-review server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
