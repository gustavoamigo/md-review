import { FileNode } from '../types';

export interface WorkspaceFileSummary {
  id: string;
  name: string;
  path: string; // e.g. "docs/architecture-spec.md"
  folder: string; // e.g. "docs" or root ""
  title: string; // extracted title e.g. "HyperScale Event Engine Specification"
  description: string;
  type: 'file' | 'folder';
}

/**
 * Calculates the relative path for a file or folder given the tree structure
 */
export function computeFilePath(node: FileNode, allNodes: FileNode[]): string {
  const parts: string[] = [node.name];
  let currParentId = node.parentId;
  let loopGuard = 0;

  while (currParentId && loopGuard < 20) {
    loopGuard++;
    const parent = allNodes.find((f) => f.id === currParentId);
    if (!parent) break;
    parts.unshift(parent.name);
    currParentId = parent.parentId;
  }

  return parts.join('/');
}

/**
 * Extracts a human-readable title from markdown content, or falls back to file name
 */
export function extractDocumentTitle(content?: string, defaultName?: string): string {
  if (content) {
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
  }
  if (!defaultName) return 'Untitled Document';
  return defaultName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extracts a concise 1-sentence summary from markdown content
 */
export function extractDocumentDescription(content?: string): string {
  if (!content) return '';
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('```') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('*')
    ) {
      continue;
    }
    return trimmed.slice(0, 110) + (trimmed.length > 110 ? '...' : '');
  }
  return '';
}

/**
 * Builds a structured summary list of all workspace files and folders
 */
export function buildWorkspaceFileSummaries(files: FileNode[]): WorkspaceFileSummary[] {
  return files.map((file) => {
    const path = computeFilePath(file, files);
    const folder = path.includes('/') ? path.split('/')[0] : '';
    const title = file.type === 'file' ? extractDocumentTitle(file.content, file.name) : file.name;
    const description = file.type === 'file' ? extractDocumentDescription(file.content) : 'Directory';

    return {
      id: file.id,
      name: file.name,
      path,
      folder,
      title,
      description,
      type: file.type,
    };
  });
}

/**
 * Formats the workspace file list into a comprehensive prompt context string for AI models
 */
export function formatWorkspaceContextForPrompt(
  files: FileNode[],
  activeDocId?: string
): string {
  const summaries = buildWorkspaceFileSummaries(files);
  const folders = summaries.filter((s) => s.type === 'folder');
  const fileSummaries = summaries.filter((s) => s.type === 'file');
  const activeSummary = summaries.find((s) => s.id === activeDocId);

  let output = `=== REAL WORKSPACE FILE SYSTEM CONTEXT ===\n`;
  output += `You have direct visibility into the user's active workspace file tree.\n\n`;

  output += `AVAILABLE FOLDERS:\n`;
  if (folders.length === 0) {
    output += `(root only)\n`;
  } else {
    folders.forEach((f) => {
      output += `- ${f.path}/\n`;
    });
  }
  output += `\n`;

  output += `ALL EXISTING WORKSPACE FILES:\n`;
  fileSummaries.forEach((f) => {
    const isActive = f.id === activeDocId ? ' [CURRENTLY ACTIVE DOCUMENT]' : '';
    output += `- Path: "${f.path}" | Title: "${f.title}" | Folder: "${f.folder || 'root'}"${isActive}\n`;
    if (f.description) {
      output += `  Summary: ${f.description}\n`;
    }
  });
  output += `\n`;

  output += `STRICT DOCUMENT LINKING RULES:\n`;
  output += `1. GROUNDING MANDATE: You MUST ONLY reference and link real files from the list above. DO NOT invent, hallucinate, or make up filenames (e.g. NEVER make up "docs/index.md", "docs/setup.md", "docs/overview.md" if they do not exist above).\n`;
  output += `2. If the user asks to "link the documents in docs" (or any folder):\n`;
  output += `   - Inspect all files whose path starts with "docs/". In this workspace, these are:\n`;
  const docsFiles = fileSummaries.filter((f) => f.path.startsWith('docs/') || f.folder === 'docs');
  docsFiles.forEach((df) => {
    output += `     * Path: "${df.path}" -> Title: "${df.title}" (${df.description || 'Spec'})\n`;
  });
  output += `   - Link every single one of those real documents using standard Markdown link syntax: [Document Title](path/to/file.md)\n`;
  output += `   - Provide a clean list or section with clear titles and brief context for each link.\n`;
  output += `3. FORMATTING MANDATE: Always output raw Markdown. NEVER wrap normal markdown prose/lists in \`\`\`markdown ... \`\`\` code fence blocks.\n`;
  output += `4. DO NOT DUPLICATE: Never duplicate surrounding blocks, footers, license notices, or existing sections.\n`;
  output += `==========================================\n\n`;

  return output;
}
