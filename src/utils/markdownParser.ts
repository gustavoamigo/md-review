import { DocumentBlock } from '../types';
import * as Diff from 'diff';

/**
 * Splits raw markdown text into contiguous semantic blocks
 */
export function parseMarkdownBlocks(rawMarkdown: string): DocumentBlock[] {
  const lines = rawMarkdown.split('\n');
  const blocks: DocumentBlock[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const currentLine = lines[i];

    // 1. Skip completely empty lines, but preserve their placement in line counting
    if (currentLine.trim() === '') {
      i++;
      continue;
    }

    const startLine = i;

    // 2. Fenced Code Block / Mermaid
    if (currentLine.trim().startsWith('```')) {
      const fenceMatch = currentLine.trim().match(/^```([a-zA-Z0-9_-]*)/);
      const lang = fenceMatch ? fenceMatch[1].toLowerCase() : '';
      const isMermaid = lang === 'mermaid';

      const codeLines: string[] = [currentLine];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        codeLines.push(lines[i]); // include closing ```
        i++;
      }

      blocks.push({
        id: `block-${blockIndex++}`,
        type: isMermaid ? 'mermaid' : 'code',
        raw: codeLines.join('\n'),
        lineStart: startLine + 1,
        lineEnd: i,
        lang: lang || 'text',
      });
      continue;
    }

    // 3. Headings (# Heading)
    const headingMatch = currentLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        id: `block-${blockIndex++}`,
        type: 'heading',
        raw: currentLine,
        lineStart: startLine + 1,
        lineEnd: startLine + 1,
        level: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // 4. Horizontal Rule (--- or *** or ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(currentLine.trim())) {
      blocks.push({
        id: `block-${blockIndex++}`,
        type: 'hr',
        raw: currentLine,
        lineStart: startLine + 1,
        lineEnd: startLine + 1,
      });
      i++;
      continue;
    }

    // 5. Blockquote (> ...)
    if (currentLine.trim().startsWith('>')) {
      const quoteLines: string[] = [currentLine];
      i++;
      while (i < lines.length && (lines[i].trim().startsWith('>') || (lines[i].trim() !== '' && !lines[i].trim().startsWith('#') && !lines[i].trim().startsWith('```')))) {
        if (lines[i].trim() === '') break;
        quoteLines.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `block-${blockIndex++}`,
        type: 'quote',
        raw: quoteLines.join('\n'),
        lineStart: startLine + 1,
        lineEnd: i,
      });
      continue;
    }

    // 6. Markdown Table (| col | col |)
    if (currentLine.trim().startsWith('|') && currentLine.trim().endsWith('|')) {
      const tableLines: string[] = [currentLine];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({
        id: `block-${blockIndex++}`,
        type: 'table',
        raw: tableLines.join('\n'),
        lineStart: startLine + 1,
        lineEnd: i,
      });
      continue;
    }

    // 7. Lists (ordered or unordered)
    const isListStart = /^(\s*[-*+]|\s*\d+\.)\s+/.test(currentLine);
    if (isListStart) {
      const listLines: string[] = [currentLine];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i];
        if (nextLine.trim() === '') {
          // Check if followed by more list items
          if (i + 1 < lines.length && /^(\s*[-*+]|\s*\d+\.)\s+/.test(lines[i + 1])) {
            listLines.push(nextLine);
            i++;
            continue;
          } else {
            break;
          }
        }
        if (/^(\s*[-*+]|\s*\d+\.)\s+/.test(nextLine) || nextLine.startsWith('   ') || nextLine.startsWith('\t')) {
          listLines.push(nextLine);
          i++;
        } else {
          break;
        }
      }
      blocks.push({
        id: `block-${blockIndex++}`,
        type: 'list',
        raw: listLines.join('\n'),
        lineStart: startLine + 1,
        lineEnd: i,
      });
      continue;
    }

    // 8. Default: Regular Paragraph
    const paraLines: string[] = [currentLine];
    i++;
    while (i < lines.length) {
      const nextLine = lines[i];
      if (
        nextLine.trim() === '' ||
        nextLine.trim().startsWith('#') ||
        nextLine.trim().startsWith('```') ||
        nextLine.trim().startsWith('>') ||
        (nextLine.trim().startsWith('|') && nextLine.trim().endsWith('|')) ||
        /^(\s*[-*+]|\s*\d+\.)\s+/.test(nextLine)
      ) {
        break;
      }
      paraLines.push(nextLine);
      i++;
    }

    blocks.push({
      id: `block-${blockIndex++}`,
      type: 'paragraph',
      raw: paraLines.join('\n'),
      lineStart: startLine + 1,
      lineEnd: i,
    });
  }

  return blocks;
}

/**
 * Replace a block's raw text and rebuild the full markdown document
 */
export function replaceBlockInDocument(
  originalDoc: string,
  targetBlock: DocumentBlock,
  newRawText: string
): string {
  let cleanedText = newRawText.trim();

  // If the suggested text contains both the new content AND the original target block repeated at the end:
  const trimmedTarget = targetBlock.raw.trim();
  if (trimmedTarget.length > 20 && cleanedText.endsWith(trimmedTarget) && cleanedText !== trimmedTarget) {
    const withoutTail = cleanedText.slice(0, cleanedText.lastIndexOf(trimmedTarget)).trim();
    if (withoutTail.length > 0) {
      cleanedText = withoutTail;
    }
  }

  const blocks = parseMarkdownBlocks(originalDoc);
  const foundIndex = blocks.findIndex((b) => b.id === targetBlock.id || b.raw.trim() === targetBlock.raw.trim());

  if (foundIndex === -1) {
    // Fallback: direct string replacement of targetBlock.raw
    if (originalDoc.includes(targetBlock.raw)) {
      return originalDoc.replace(targetBlock.raw, cleanedText);
    }
    return originalDoc;
  }

  blocks[foundIndex].raw = cleanedText;
  return blocks.map((b) => b.raw).join('\n\n');
}

/**
 * Inserts a new block into a document cleanly before, after, or at the end
 */
export function insertBlockInDocument(
  originalDoc: string,
  targetBlockId: string | null,
  position: 'before' | 'after' | 'end',
  newBlockRaw: string
): string {
  const cleanNewBlock = newBlockRaw.trim();
  if (!cleanNewBlock) return originalDoc;

  if (position === 'end' || !targetBlockId) {
    return originalDoc.trimEnd() + '\n\n' + cleanNewBlock + '\n';
  }

  const blocks = parseMarkdownBlocks(originalDoc);
  const foundIndex = blocks.findIndex((b) => b.id === targetBlockId);

  if (foundIndex === -1) {
    return originalDoc.trimEnd() + '\n\n' + cleanNewBlock + '\n';
  }

  const insertIdx = position === 'before' ? foundIndex : foundIndex + 1;
  blocks.splice(insertIdx, 0, {
    id: `block-inserted-${Date.now()}`,
    type: 'paragraph',
    raw: cleanNewBlock,
    lineStart: 0,
    lineEnd: 0,
  });

  return blocks.map((b) => b.raw).join('\n\n');
}

/**
 * Detects and removes trailing duplicate sections or footers that models sometimes repeat
 */
export function deduplicateTrailingRepeatedSections(markdown: string): string {
  const trimmed = markdown.trim();
  const blocks = parseMarkdownBlocks(trimmed);
  if (blocks.length < 3) return trimmed;

  // Check if the last 1 or 2 blocks are duplicates of earlier blocks
  const lastBlock = blocks[blocks.length - 1];
  const secondLastBlock = blocks.length >= 2 ? blocks[blocks.length - 2] : null;

  const duplicateLastIndex = blocks.slice(0, blocks.length - 1).findIndex(
    (b) => b.raw.trim() === lastBlock.raw.trim()
  );

  if (duplicateLastIndex !== -1) {
    // If the 2nd last is also a heading match for the previous block, remove both
    if (
      secondLastBlock &&
      duplicateLastIndex > 0 &&
      blocks[duplicateLastIndex - 1].raw.trim() === secondLastBlock.raw.trim()
    ) {
      blocks.splice(blocks.length - 2, 2);
      return blocks.map((b) => b.raw).join('\n\n');
    }
    blocks.pop();
    return blocks.map((b) => b.raw).join('\n\n');
  }

  return trimmed;
}

/**
 * Computes additions and deletions counts between two markdown strings
 */
export function computeDiffStats(original: string, modified: string): { additions: number; deletions: number } {
  const changes = Diff.diffLines(original, modified);
  let additions = 0;
  let deletions = 0;

  for (const part of changes) {
    if (part.added) {
      additions += part.count || 1;
    } else if (part.removed) {
      deletions += part.count || 1;
    }
  }

  return { additions, deletions };
}
