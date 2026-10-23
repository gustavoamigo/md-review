import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FileText,
  Sparkles,
  Edit3,
  MessageSquare,
  History,
  RotateCcw,
  RotateCw,
  Download,
  Settings,
  Upload,
  Info,
  ChevronRight,
  ChevronDown,
  List,
  Check,
  Copy,
  Layers,
  ArrowRight,
  Wand2,
  CornerDownLeft,
  Folder,
  Plus,
} from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { marked } from 'marked';

import {
  DocumentBlock,
  DocumentSnapshot,
  ReviewProposal,
  ReviewComment,
  AIProviderConfig,
  MermaidErrorContext,
  MermaidValidationResult,
  FileNode,
} from './types';
import { sampleDocs } from './data/sampleDocs';
import { initialFiles } from './data/initialFiles';
import {
  parseMarkdownBlocks,
  replaceBlockInDocument,
  insertBlockInDocument,
  deduplicateTrailingRepeatedSections,
  computeDiffStats,
} from './utils/markdownParser';
import {
  formatWorkspaceContextForPrompt,
  buildWorkspaceFileSummaries,
  computeFilePath,
} from './utils/workspaceContext';
import { MermaidDiagram } from './components/MermaidDiagram';
import { InlineDiffView } from './components/InlineDiffView';
import { VersionHistoryDrawer } from './components/VersionHistoryDrawer';
import { TextSelectionToolbar } from './components/TextSelectionToolbar';
import { CommentsPanel } from './components/CommentsPanel';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { FileExplorer } from './components/FileExplorer';
import { formatMermaidMarkdown } from './utils/mermaidSanitizer';

// Ensure marked uses GitHub Flavored Markdown and breaks
marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function App() {
  // Virtual file system state
  const [files, setFiles] = useState<FileNode[]>(() => {
    const saved = localStorage.getItem('marksmith_files_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // ignore
      }
    }
    return initialFiles;
  });

  const [activeDocId, setActiveDocId] = useState<string>(() => {
    return localStorage.getItem('marksmith_active_file_id_v2') || 'file-architecture-spec';
  });

  const [filename, setFilename] = useState<string>(() => {
    const active = initialFiles.find((f) => f.id === 'file-architecture-spec');
    return active ? active.name : 'architecture-spec.md';
  });

  const [markdownContent, setMarkdownContent] = useState<string>(() => {
    const active = initialFiles.find((f) => f.id === 'file-architecture-spec');
    return active?.content || sampleDocs[0].content;
  });

  // Persist files in local storage
  useEffect(() => {
    try {
      localStorage.setItem('marksmith_files_v2', JSON.stringify(files));
    } catch (e) {
      // ignore
    }
  }, [files]);

  useEffect(() => {
    try {
      localStorage.setItem('marksmith_active_file_id_v2', activeDocId);
    } catch (e) {
      // ignore
    }
  }, [activeDocId]);

  // History & Snapshot State (linear undo/redo stack + checkpoints)
  const [snapshots, setSnapshots] = useState<DocumentSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Review & Diff State
  const [activeProposals, setActiveProposals] = useState<Record<string, ReviewProposal>>({});
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [loadingBlockId, setLoadingBlockId] = useState<string | null>(null);

  // Hover & Selection Editing State
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [blockPromptText, setBlockPromptText] = useState<string>('');

  // Insert Block State
  const [insertingAtPosition, setInsertingAtPosition] = useState<{
    targetBlockId: string | null;
    position: 'before' | 'after' | 'end';
  } | null>(null);
  const [insertPromptText, setInsertPromptText] = useState<string>('');
  const [isInsertingAi, setIsInsertingAi] = useState<boolean>(false);

  // Global / Full Document Prompt State
  const [globalPromptText, setGlobalPromptText] = useState<string>('');
  const [isGlobalAiLoading, setIsGlobalAiLoading] = useState(false);

  // Selection Floating Toolbar State
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number } | null>(null);

  // Comments State
  const [comments, setComments] = useState<ReviewComment[]>([
    {
      id: 'comm-1',
      blockId: 'block-1',
      blockPreview: 'sub-5ms p99 latency across globally distributed consumer groups',
      text: 'Double-check if this SLA applies to cross-region WAN links or local VPC peering.',
      author: 'Gustavo Amigo',
      createdAt: Date.now() - 1000 * 60 * 18,
      resolved: false,
    },
    {
      id: 'comm-2',
      blockId: 'block-3',
      blockPreview: 'sequenceDiagram autonumber actor Client as IoT Edge Device...',
      text: 'Verified diagram syntax. Consider adding a timeout fallback branch.',
      author: 'Elena Rostova',
      createdAt: Date.now() - 1000 * 60 * 45,
      resolved: true,
    },
  ]);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'outline' | 'comments'>('files');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIProviderConfig>({
    provider: 'gemini',
    endpoint: 'http://localhost:11434/v1',
    model: 'gemini-3.1-flash-lite',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentContainerRef = useRef<HTMLDivElement>(null);

  // Parse markdown into discrete blocks
  const blocks = useMemo(() => parseMarkdownBlocks(markdownContent), [markdownContent]);

  // Record initial snapshot once
  useEffect(() => {
    const initialSnapshot: DocumentSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: 'Initial Document Loaded',
      author: 'system',
      content: markdownContent,
      additions: 0,
      deletions: 0,
    };
    setSnapshots([initialSnapshot]);
    setHistoryIndex(0);
  }, []);

  // Keyboard shortcut listener for Undo (Cmd+Z) and Redo (Cmd+Shift+Z / Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [snapshots, historyIndex]);

  // Capture text selection in the document
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectedText('');
      setSelectionCoords(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 3) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionCoords({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 - 160,
      });
    } else {
      setSelectedText('');
      setSelectionCoords(null);
    }
  };

  // Intercept click on document links: navigate to local workspace files if relative link
  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Check if it's an internal / relative link (not http:// or https:// or mailto:)
    if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
      const cleanHref = href.replace(/^\.?\//, '').trim();
      const matched = files.find((f) => {
        if (f.type !== 'file') return false;
        const p = computeFilePath(f, files);
        return p === cleanHref || f.name === cleanHref || p.endsWith('/' + cleanHref);
      });

      if (matched) {
        e.preventDefault();
        setFiles((prev) =>
          prev.map((f) => (f.id === activeDocId ? { ...f, content: markdownContent } : f))
        );
        setActiveDocId(matched.id);
        setFilename(matched.name);
        setMarkdownContent(matched.content || '');
        setActiveProposals({});
        setEditingBlockId(null);
      }
    }
  };

  // Select and open file from explorer
  const handleSelectFile = (fileId: string) => {
    const target = files.find((f) => f.id === fileId);
    if (!target || target.type === 'folder') return;

    // Cache current edits before switching
    setFiles((prev) =>
      prev.map((f) => (f.id === activeDocId ? { ...f, content: markdownContent } : f))
    );

    setActiveDocId(target.id);
    setFilename(target.name);
    setMarkdownContent(target.content || '');
    setActiveProposals({});
    setEditingBlockId(null);

    const newSnap: DocumentSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: `Opened ${target.name}`,
      author: 'system',
      content: target.content || '',
      additions: 0,
      deletions: 0,
    };
    setSnapshots([newSnap]);
    setHistoryIndex(0);
  };

  // Create new file
  const handleCreateFile = (name: string, parentId?: string | null, templateType = 'blank') => {
    let content = `# ${name.replace(/\.[^/.]+$/, '')}\n\n`;
    if (templateType === 'sequence') {
      content += `\`\`\`mermaid\nsequenceDiagram\n    autonumber\n    actor Client\n    participant API as Service Gateway\n    participant DB as Database\n\n    Client->>API: GET /v1/resource\n    API->>DB: Query records\n    DB-->>API: Return dataset\n    API-->>Client: 200 OK JSON\n\`\`\`\n`;
    } else if (templateType === 'flowchart') {
      content += `\`\`\`mermaid\nflowchart TD\n    Start([Start Ingestion]) --> Step1[Parse Request Payload]\n    Step1 --> Step2{Valid?}\n    Step2 -- Yes --> Process[Compute Result & Cache]\n    Step2 -- No --> Error[Log Warning & Reject]\n    Process --> Finish([Persist to DB])\n\`\`\`\n`;
    } else if (templateType === 'state') {
      content += `\`\`\`mermaid\nstateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing: Event Dispatched\n    Processing --> Success: Job Finished\n    Processing --> Failed: Exception Thrown\n    Failed --> Idle: Retry Policy\n    Success --> [*]\n\`\`\`\n`;
    } else {
      content += `Start editing this document or add a Mermaid diagram with \`\`\`mermaid ... \`\`\`.\n`;
    }

    const newFile: FileNode = {
      id: `file-${Date.now()}`,
      name,
      type: 'file',
      parentId: parentId || null,
      content,
      isModified: false,
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveDocId(newFile.id);
    setFilename(newFile.name);
    setMarkdownContent(content);
    setActiveProposals({});
    setEditingBlockId(null);

    const newSnap: DocumentSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: `Created ${newFile.name}`,
      author: 'user',
      content,
      additions: 0,
      deletions: 0,
    };
    setSnapshots([newSnap]);
    setHistoryIndex(0);
  };

  // Create new folder
  const handleCreateFolder = (name: string, parentId?: string | null) => {
    const newFolder: FileNode = {
      id: `folder-${Date.now()}`,
      name,
      type: 'folder',
      parentId: parentId || null,
      isOpen: true,
    };
    setFiles((prev) => [...prev, newFolder]);
  };

  // Rename node
  const handleRenameNode = (id: string, newName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
    );
    if (id === activeDocId) {
      setFilename(newName);
    }
  };

  // Delete node recursively
  const handleDeleteNode = (id: string) => {
    const idsToDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of files) {
        if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
          idsToDelete.add(f.id);
          changed = true;
        }
      }
    }

    const remaining = files.filter((f) => !idsToDelete.has(f.id));
    setFiles(remaining);

    if (idsToDelete.has(activeDocId)) {
      const nextFile = remaining.find((f) => f.type === 'file');
      if (nextFile) {
        setActiveDocId(nextFile.id);
        setFilename(nextFile.name);
        setMarkdownContent(nextFile.content || '');
        setActiveProposals({});
      } else {
        const fallback: FileNode = {
          id: `file-${Date.now()}`,
          name: 'untitled.md',
          type: 'file',
          parentId: null,
          content: '# Untitled Document\n\nCreate a new file to get started.',
        };
        setFiles([fallback]);
        setActiveDocId(fallback.id);
        setFilename(fallback.name);
        setMarkdownContent(fallback.content || '');
      }
    }
  };

  // Duplicate file
  const handleDuplicateFile = (id: string) => {
    const source = files.find((f) => f.id === id);
    if (!source || source.type === 'folder') return;

    const extIndex = source.name.lastIndexOf('.');
    const baseName = extIndex !== -1 ? source.name.slice(0, extIndex) : source.name;
    const ext = extIndex !== -1 ? source.name.slice(extIndex) : '';
    const newName = `${baseName}-copy${ext}`;

    const duplicate: FileNode = {
      id: `file-${Date.now()}`,
      name: newName,
      type: 'file',
      parentId: source.parentId,
      content: source.content,
      isModified: false,
    };

    setFiles((prev) => [...prev, duplicate]);
  };

  // Toggle folder open/closed
  const handleToggleFolder = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isOpen: !f.isOpen } : f))
    );
  };

  // Helper to commit document changes and save snapshot
  const commitDocumentChange = (newContent: string, label: string, instruction?: string, author: 'ai' | 'user' = 'ai') => {
    const diff = computeDiffStats(markdownContent, newContent);
    const newSnapshot: DocumentSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label,
      author,
      content: newContent,
      instruction,
      additions: diff.additions,
      deletions: diff.deletions,
    };

    // Trim any future redo history if we made a new branching edit
    const updatedSnapshots = [newSnapshot, ...snapshots.slice(historyIndex >= 0 ? historyIndex : 0)];
    setSnapshots(updatedSnapshots);
    setHistoryIndex(0);
    setMarkdownContent(newContent);

    // Sync to files array
    setFiles((prev) =>
      prev.map((f) =>
        f.id === activeDocId
          ? { ...f, content: newContent, isModified: true }
          : f
      )
    );
  };


  // Undo Handler
  const handleUndo = () => {
    if (historyIndex < snapshots.length - 1) {
      const nextIndex = historyIndex + 1;
      const targetSnapshot = snapshots[nextIndex];
      if (targetSnapshot) {
        setHistoryIndex(nextIndex);
        setMarkdownContent(targetSnapshot.content);
        setActiveProposals({});
      }
    }
  };

  // Redo Handler
  const handleRedo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const targetSnapshot = snapshots[prevIndex];
      if (targetSnapshot) {
        setHistoryIndex(prevIndex);
        setMarkdownContent(targetSnapshot.content);
        setActiveProposals({});
      }
    }
  };

  // Revert directly to any selected snapshot from the drawer
  const handleRevertToSnapshot = (snapshot: DocumentSnapshot) => {
    commitDocumentChange(snapshot.content, `Reverted to snapshot: ${snapshot.label}`, undefined, 'user');
  };

  // Create manual checkpoint
  const handleCreateCheckpoint = (label: string) => {
    const newSnapshot: DocumentSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: Date.now(),
      label: `Checkpoint: ${label}`,
      author: 'user',
      content: markdownContent,
      additions: 0,
      deletions: 0,
    };
    setSnapshots((prev) => [newSnapshot, ...prev]);
  };

  // Trigger AI review for a specific block or text
  const handleRequestBlockReview = async (targetBlock: DocumentBlock, instruction: string) => {
    setLoadingBlockId(targetBlock.id);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai/review-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          originalText: targetBlock.raw,
          surroundingContext: markdownContent.slice(0, 3000),
          isDiagram: targetBlock.type === 'mermaid',
          providerConfig: aiConfig,
          workspaceFiles: buildWorkspaceFileSummaries(files),
          workspaceContextText: formatWorkspaceContextForPrompt(files, activeDocId),
          isWholeDocument: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to review block');
      }

      const proposal: ReviewProposal = {
        id: `prop-${Date.now()}`,
        blockId: targetBlock.id,
        instruction,
        originalText: targetBlock.raw,
        suggestedText: data.suggestedText,
        status: 'pending',
        feedbackThread: [],
        isDiagram: targetBlock.type === 'mermaid',
        validationResult: data.validationResult,
        createdAt: Date.now(),
      };

      setActiveProposals((prev) => ({
        ...prev,
        [targetBlock.id]: proposal,
      }));
      setEditingBlockId(null);
      setBlockPromptText('');
    } catch (err: any) {
      alert(`AI Review error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
      setLoadingBlockId(null);
    }
  };

  // Trigger AI review for text selected with cursor
  const handleRequestSelectionReview = async (instruction: string, selectedSnippet: string) => {
    // Find the enclosing block for this snippet
    const targetBlock = blocks.find((b) => b.raw.includes(selectedSnippet)) || blocks[0];
    await handleRequestBlockReview(targetBlock, instruction);
  };

  // Full Document AI Review ("number these headings", "move this section above...", etc.)
  const handleRequestGlobalReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalPromptText.trim() || isGlobalAiLoading) return;

    setIsGlobalAiLoading(true);
    try {
      const res = await fetch('/api/ai/review-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: globalPromptText.trim(),
          originalText: markdownContent,
          isDiagram: false,
          providerConfig: aiConfig,
          workspaceFiles: buildWorkspaceFileSummaries(files),
          workspaceContextText: formatWorkspaceContextForPrompt(files, activeDocId),
          isWholeDocument: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to execute global document edit');
      }

      // Automatically deduplicate trailing duplicate sections/footers if repeated
      const cleanDoc = deduplicateTrailingRepeatedSections(data.suggestedText);

      commitDocumentChange(
        cleanDoc,
        `AI Global: ${globalPromptText.trim()}`,
        globalPromptText.trim(),
        'ai'
      );
      setGlobalPromptText('');
    } catch (err: any) {
      alert(`Global edit error: ${err.message}`);
    } finally {
      setIsGlobalAiLoading(false);
    }
  };

  // Dedicated Insert Block via AI without overwriting or repeating surrounding blocks
  const handleRequestInsertBlock = async (
    targetBlockId: string | null,
    position: 'before' | 'after' | 'end',
    instruction: string
  ) => {
    setIsInsertingAi(true);
    try {
      const res = await fetch('/api/ai/review-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: `Generate a new markdown block to insert: ${instruction}`,
          originalText: '',
          surroundingContext: markdownContent.slice(0, 3000),
          isDiagram:
            instruction.toLowerCase().includes('mermaid') ||
            instruction.toLowerCase().includes('diagram') ||
            instruction.toLowerCase().includes('flowchart') ||
            instruction.toLowerCase().includes('sequence'),
          providerConfig: aiConfig,
          workspaceFiles: buildWorkspaceFileSummaries(files),
          workspaceContextText: formatWorkspaceContextForPrompt(files, activeDocId),
          isWholeDocument: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate new block');
      }

      const newDoc = insertBlockInDocument(
        markdownContent,
        targetBlockId,
        position,
        data.suggestedText
      );
      commitDocumentChange(newDoc, `AI Insert: ${instruction}`, instruction, 'ai');
      setInsertingAtPosition(null);
      setInsertPromptText('');
    } catch (err: any) {
      alert(`Insert error: ${err.message}`);
    } finally {
      setIsInsertingAi(false);
    }
  };

  // Revise proposal with user feedback
  const handleReviseProposal = async (proposal: ReviewProposal, feedback: string) => {
    setLoadingBlockId(proposal.blockId);
    setIsAiLoading(true);

    const updatedFeedback = [
      ...proposal.feedbackThread,
      {
        instruction: proposal.instruction,
        suggested: proposal.suggestedText,
        feedback,
        timestamp: Date.now(),
      },
    ];

    try {
      const res = await fetch('/api/ai/review-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: feedback.trim(),
          originalText: proposal.suggestedText || proposal.originalText,
          feedbackThread: updatedFeedback,
          isDiagram: proposal.isDiagram,
          providerConfig: aiConfig,
          workspaceFiles: buildWorkspaceFileSummaries(files),
          workspaceContextText: formatWorkspaceContextForPrompt(files, activeDocId),
          isWholeDocument: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revise proposal');
      }

      setActiveProposals((prev) => ({
        ...prev,
        [proposal.blockId]: {
          ...proposal,
          instruction: feedback.trim(),
          suggestedText: data.suggestedText,
          validationResult: data.validationResult,
          feedbackThread: updatedFeedback,
        },
      }));
    } catch (err: any) {
      alert(`Revision error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
      setLoadingBlockId(null);
    }
  };

  // Auto-repair Mermaid diagram syntax using specific error context
  const handleAutoRepairMermaid = async (
    targetBlockId: string,
    brokenCode: string,
    errorMessage: string,
    errorContext?: MermaidErrorContext
  ) => {
    setLoadingBlockId(targetBlockId);
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/repair-mermaid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokenCode,
          errorMessage,
          errorContext,
          providerConfig: aiConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to repair Mermaid diagram');
      }

      // If there is an active proposal for this block, update the proposal's suggestedText & validationResult
      if (activeProposals[targetBlockId]) {
        setActiveProposals((prev) => ({
          ...prev,
          [targetBlockId]: {
            ...prev[targetBlockId],
            suggestedText: data.formattedBlock,
            diagramError: null,
            validationResult: data.validationResult,
          },
        }));
      } else {
        const targetBlock = blocks.find((b) => b.id === targetBlockId);
        if (targetBlock) {
          const newDoc = replaceBlockInDocument(markdownContent, targetBlock, data.formattedBlock);
          commitDocumentChange(newDoc, 'AI: Auto-repaired Mermaid diagram syntax', 'Fix Mermaid syntax', 'ai');
        }
      }
    } catch (err: any) {
      alert(`Repair error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
      setLoadingBlockId(null);
    }
  };

  // Accept proposal
  const handleAcceptProposal = (proposal: ReviewProposal) => {
    const targetBlock = blocks.find((b) => b.id === proposal.blockId);
    if (!targetBlock) return;

    const isDiagram =
      proposal.isDiagram ||
      targetBlock.type === 'mermaid' ||
      targetBlock.raw.includes('mermaid');

    const finalText = isDiagram
      ? formatMermaidMarkdown(proposal.suggestedText)
      : proposal.suggestedText;

    const newDoc = replaceBlockInDocument(markdownContent, targetBlock, finalText);
    commitDocumentChange(newDoc, `AI: ${proposal.instruction}`, proposal.instruction, 'ai');

    // Remove proposal from active proposals
    setActiveProposals((prev) => {
      const copy = { ...prev };
      delete copy[proposal.blockId];
      return copy;
    });
  };

  // Reject / Discard proposal
  const handleRejectProposal = (proposal: ReviewProposal) => {
    setActiveProposals((prev) => {
      const copy = { ...prev };
      delete copy[proposal.blockId];
      return copy;
    });
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const newFileId = `upload-${Date.now()}`;
        const newFileNode: FileNode = {
          id: newFileId,
          name: file.name,
          type: 'file',
          parentId: null,
          content,
          isModified: false,
        };
        setFiles((prev) => [...prev, newFileNode]);
        setFilename(file.name);
        setActiveDocId(newFileId);
        setMarkdownContent(content);
        setActiveProposals({});
        commitDocumentChange(content, `Uploaded file: ${file.name}`, undefined, 'user');
      }
    };
    reader.readAsText(file);
  };

  // File Download Handler
  const handleDownloadFile = () => {
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add Comment
  const handleAddComment = (blockId: string, text: string) => {
    const targetBlock = blocks.find((b) => b.id === blockId);
    const newComment: ReviewComment = {
      id: `comm-${Date.now()}`,
      blockId,
      blockPreview: targetBlock ? targetBlock.raw.slice(0, 60).replace(/\n/g, ' ') : '',
      text,
      author: 'Gustavo Amigo',
      createdAt: Date.now(),
      resolved: false,
    };
    setComments((prev) => [newComment, ...prev]);
  };

  const handleToggleResolveComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c))
    );
  };

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const scrollToBlock = (blockId: string) => {
    const el = document.getElementById(`doc-${blockId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-50/30');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-50/30');
      }, 1600);
    }
  };

  // Table of contents headings
  const tocHeadings = useMemo(() => {
    return blocks.filter((b) => b.type === 'heading');
  }, [blocks]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Top Bar Contract (Strict 3-zone layout) */}
      <header className="flex h-14 items-center justify-between gap-8 border-b border-slate-200 bg-white px-5 shrink-0 z-30">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <a href="#" className="flex items-center gap-2 font-bold tracking-tight text-slate-900 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Edit3 className="h-4 w-4" />
            </span>
            <span className="font-extrabold tracking-tight">md-review</span>
          </a>
          <span className="hidden sm:inline-block text-slate-400">/</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            {filename}
          </span>
        </div>

        {/* Zone 2: Navigation Links / Fast Switcher & Undo/Redo & History */}
        <div className="flex items-center gap-3 overflow-x-auto text-sm">
          {/* Quick Undo / Redo controls */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
            <button
              onClick={handleUndo}
              disabled={historyIndex >= snapshots.length - 1}
              title="Undo (Cmd+Z)"
              className="rounded-md p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex <= 0}
              title="Redo (Cmd+Shift+Z)"
              className="rounded-md p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* History Drawer Trigger */}
          <button
            onClick={() => setIsHistoryDrawerOpen(true)}
            title="Version History & Snapshots"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap"
          >
            <History className="h-3.5 w-3.5 text-indigo-600" />
            <span>History</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
              {snapshots.length}
            </span>
          </button>

          {/* Model Badge */}
          <div
            onClick={() => setIsSettingsOpen(true)}
            className="hidden md:flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-medium">
              {aiConfig.provider === 'gemini'
                ? 'Gemini 3.8 Flash'
                : aiConfig.provider === 'ollama'
                ? `Ollama (${aiConfig.model})`
                : aiConfig.model}
            </span>
          </div>
        </div>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".md,.markdown,.txt"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload local markdown file"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            <span>Open File</span>
          </button>

          <button
            onClick={handleDownloadFile}
            title="Download modified markdown file"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 active:bg-indigo-800 transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Save .md</span>
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Model & Provider Settings"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsAboutOpen(true)}
            title="About md-review & Creator Quotes"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-2xs"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar (Outline, Comments, Sample Documents) */}
        <aside
          className={`border-r border-slate-200 bg-white flex flex-col shrink-0 transition-all duration-200 ${
            isSidebarOpen ? 'w-72 sm:w-80' : 'w-12'
          }`}
        >
          {isSidebarOpen ? (
            <div className="flex h-full flex-col">
              {/* Sidebar Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 text-xs">
                <button
                  onClick={() => setSidebarTab('files')}
                  className={`flex-1 rounded-md py-1.5 font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    sidebarTab === 'files'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Folder className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Files</span>
                </button>
                <button
                  onClick={() => setSidebarTab('outline')}
                  className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${
                    sidebarTab === 'outline'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Outline
                </button>
                <button
                  onClick={() => setSidebarTab('comments')}
                  className={`flex-1 rounded-md py-1.5 font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    sidebarTab === 'comments'
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Comments
                  {comments.filter((c) => !c.resolved).length > 0 && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                      {comments.filter((c) => !c.resolved).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto">
                {sidebarTab === 'files' && (
                  <FileExplorer
                    files={files}
                    activeFileId={activeDocId}
                    onSelectFile={handleSelectFile}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onRenameNode={handleRenameNode}
                    onDeleteNode={handleDeleteNode}
                    onDuplicateFile={handleDuplicateFile}
                    onToggleFolder={handleToggleFolder}
                  />
                )}

                {sidebarTab === 'outline' && (
                  <div className="p-3 space-y-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                      Table of Contents
                    </div>
                    {tocHeadings.length === 0 ? (
                      <div className="px-2 py-6 text-center text-xs text-slate-400">
                        No headings in current document
                      </div>
                    ) : (
                      tocHeadings.map((head) => (
                        <button
                          key={head.id}
                          onClick={() => scrollToBlock(head.id)}
                          className={`w-full text-left rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 truncate block transition-colors ${
                            head.level === 1
                              ? 'font-bold text-slate-900'
                              : head.level === 2
                              ? 'font-medium pl-4'
                              : 'pl-6 text-slate-600'
                          }`}
                        >
                          {head.raw.replace(/^#+\s*/, '')}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {sidebarTab === 'comments' && (
                  <CommentsPanel
                    comments={comments}
                    activeBlockId={hoveredBlockId}
                    onAddComment={handleAddComment}
                    onToggleResolve={handleToggleResolveComment}
                    onDeleteComment={handleDeleteComment}
                    onScrollToBlock={scrollToBlock}
                  />
                )}
              </div>

              {/* Sidebar Footer toggle */}
              <div className="border-t border-slate-200 p-2 flex items-center justify-between bg-slate-50 text-xs text-slate-500">
                <span className="text-[11px] px-1 font-mono text-slate-400">
                  {files.filter((f) => f.type === 'file').length} docs loaded
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                  title="Collapse Sidebar"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                title="Expand Sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setIsSidebarOpen(true);
                  setSidebarTab('files');
                }}
                className={`rounded p-1.5 transition-colors ${
                  sidebarTab === 'files'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="File Explorer"
              >
                <Folder className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setIsSidebarOpen(true);
                  setSidebarTab('outline');
                }}
                className={`rounded p-1.5 transition-colors ${
                  sidebarTab === 'outline'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Document Outline"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setIsSidebarOpen(true);
                  setSidebarTab('comments');
                }}
                className={`rounded p-1.5 transition-colors relative ${
                  sidebarTab === 'comments'
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
                title="Review Comments"
              >
                <MessageSquare className="h-4 w-4" />
                {comments.filter((c) => !c.resolved).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-indigo-600" />
                )}
              </button>
            </div>
          )}
        </aside>

        {/* Center Document Viewport */}
        <main
          ref={documentContainerRef}
          onMouseUp={handleMouseUp}
          onClick={handleDocumentClick}
          className="flex-1 overflow-y-auto bg-slate-100/60 p-4 sm:p-8 flex justify-center"
        >
          <div className="w-full max-w-4xl pb-24">
            {/* Document Card Shell */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-12 shadow-sm markdown-body">
              {/* Document Meta Banner */}
              <div className="mb-8 flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-700">{filename}</span>
                  <span>·</span>
                  <span>{blocks.length} semantic blocks</span>
                  <span>·</span>
                  <span>{markdownContent.split(/\s+/).length} words</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="italic">Hover any block to ✏️ rewrite with AI or ➕ insert</span>
                </div>
              </div>

              {/* Rendered Semantic Blocks */}
              <div className="space-y-4">
                {blocks.map((block) => {
                  const hasProposal = Boolean(activeProposals[block.id]);
                  const isHovered = hoveredBlockId === block.id;
                  const isEditingThisBlock = editingBlockId === block.id;
                  const isInsertingHere = insertingAtPosition?.targetBlockId === block.id;
                  const isBlockLoading = loadingBlockId === block.id;
                  const hasComment = comments.some((c) => c.blockId === block.id);

                  return (
                    <div
                      key={block.id}
                      id={`doc-${block.id}`}
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      className={`relative group rounded-xl p-2 transition-all ${
                        isHovered && !hasProposal ? 'bg-indigo-50/20' : ''
                      } ${hasProposal ? 'p-0' : ''}`}
                    >
                      {/* Floating In-Document Block Action Handle */}
                      {isHovered && !hasProposal && !isEditingThisBlock && !isInsertingHere && (
                        <div className="absolute -top-3.5 right-4 z-20 flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-1.5 py-1 shadow-md animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => {
                              setEditingBlockId(block.id);
                              setBlockPromptText('');
                            }}
                            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                            title="Edit this block with AI"
                          >
                            <Sparkles className="h-3 w-3 text-indigo-600" />
                            <span>Edit Block</span>
                          </button>

                          <div className="h-3 w-[1px] bg-slate-200" />

                          <button
                            onClick={() => {
                              setInsertingAtPosition({ targetBlockId: block.id, position: 'after' });
                              setInsertPromptText('');
                            }}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                            title="Insert new block below this block"
                          >
                            <Plus className="h-3 w-3 text-indigo-600" />
                            <span>Add Below</span>
                          </button>

                          <div className="h-3 w-[1px] bg-slate-200" />

                          <button
                            onClick={() => {
                              setSidebarTab('comments');
                              setIsSidebarOpen(true);
                            }}
                            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Add comment on this block"
                          >
                            <MessageSquare className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      {/* In-Block Quick AI Insert Below Form */}
                      {isInsertingHere && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (insertPromptText.trim()) {
                              handleRequestInsertBlock(block.id, insertingAtPosition.position, insertPromptText.trim());
                            }
                          }}
                          className="my-3 rounded-xl border border-indigo-300 bg-indigo-50/70 p-3.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                              <Plus className="h-3.5 w-3.5 text-indigo-600" />
                              Insert Block Below
                            </span>
                            <button
                              type="button"
                              onClick={() => setInsertingAtPosition(null)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={insertPromptText}
                              onChange={(e) => setInsertPromptText(e.target.value)}
                              placeholder='e.g., "Add a block linking the documents in docs", "Add a sequence diagram for auth"...'
                              className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={isInsertingAi || !insertPromptText.trim()}
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                              <Wand2 className="h-3 w-3" />
                              {isInsertingAi ? 'Generating...' : 'Insert Block'}
                            </button>
                          </div>

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {[
                              'Add a block linking the documents in docs',
                              'Add a Mermaid sequence diagram',
                              'Add an architectural overview table',
                              'Add a disaster recovery checklist',
                            ].map((quick) => (
                              <button
                                key={quick}
                                type="button"
                                onClick={() =>
                                  handleRequestInsertBlock(block.id, insertingAtPosition.position, quick)
                                }
                                className="rounded bg-white/90 border border-indigo-100 px-2 py-0.5 text-[10px] text-indigo-800 hover:bg-indigo-100 shadow-2xs font-medium"
                              >
                                {quick}
                              </button>
                            ))}
                          </div>
                        </form>
                      )}

                      {/* In-Block Quick AI Prompt Form */}
                      {isEditingThisBlock && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (blockPromptText.trim()) {
                              handleRequestBlockReview(block, blockPromptText.trim());
                            }
                          }}
                          className="my-3 rounded-xl border border-indigo-300 bg-indigo-50/60 p-3.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                              AI Block Rewriter
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingBlockId(null)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={blockPromptText}
                              onChange={(e) => setBlockPromptText(e.target.value)}
                              placeholder='e.g., "Make this shorter", "Convert into table", "Number these headings", "Make tone technical"...'
                              className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={isAiLoading || !blockPromptText.trim()}
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                              <Wand2 className="h-3 w-3" />
                              Rewrite
                            </button>
                          </div>

                          {/* Quick suggestions tailored to block type */}
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {(block.type === 'mermaid'
                              ? [
                                  'Convert to sequence diagram',
                                  'Convert to flowchart',
                                  'Add cache bypass branch',
                                  'Shorten node labels',
                                ]
                              : [
                                  'Make this shorter',
                                  'Fix grammar & clarity',
                                  'Number headings',
                                  'Add precision',
                                ]
                            ).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => handleRequestBlockReview(block, q)}
                                className="rounded bg-white/90 border border-indigo-100 px-2 py-0.5 text-[10px] text-indigo-800 hover:bg-indigo-100 shadow-2xs font-medium"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </form>
                      )}

                      {/* Loading State when AI is processing this block */}
                      {isBlockLoading && (
                        <div className="my-3 flex items-center justify-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 py-4 px-6 text-xs text-indigo-950 shadow-xs animate-pulse">
                          <RotateCw className="h-4 w-4 animate-spin text-indigo-600" />
                          <span className="font-semibold">
                            {block.type === 'mermaid'
                              ? 'AI is converting & checking diagram syntax...'
                              : 'AI is reviewing and generating diff...'}
                          </span>
                        </div>
                      )}

                      {/* Display Active Diff OR Rendered Block */}
                      {hasProposal ? (
                        <InlineDiffView
                          proposal={activeProposals[block.id]}
                          onAccept={handleAcceptProposal}
                          onReject={handleRejectProposal}
                          onRevise={handleReviseProposal}
                          onAutoRepairDiagram={async (brokenCode, err, ctx) => {
                            await handleAutoRepairMermaid(block.id, brokenCode, err, ctx);
                          }}
                          isRevising={isBlockLoading}
                        />
                      ) : (
                        /* Standard Block Rendering */
                        <div>
                          {/* Mermaid Block */}
                          {block.type === 'mermaid' ? (
                            <MermaidDiagram
                              code={block.raw}
                              id={block.id}
                              onAutoRepair={(code, err, ctx) => handleAutoRepairMermaid(block.id, code, err, ctx)}
                              isRepairing={isAiLoading && loadingBlockId === block.id}
                            />
                          ) : block.type === 'code' ? (
                            /* Code Block with Syntax Highlighting */
                            <div className="relative group/code my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-1.5 text-[11px] font-mono text-slate-400">
                                <span>{block.lang || 'code'}</span>
                                <button
                                  onClick={() => {
                                    const codeOnly = block.raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
                                    navigator.clipboard.writeText(codeOnly);
                                  }}
                                  className="hover:text-white"
                                  title="Copy Code"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="p-4 text-xs font-mono overflow-x-auto text-slate-200">
                                <code>{block.raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '')}</code>
                              </pre>
                            </div>
                          ) : block.type === 'heading' ? (
                            /* Headings */
                            <div className="relative">
                              {block.level === 1 && <h1>{block.raw.replace(/^#\s+/, '')}</h1>}
                              {block.level === 2 && <h2>{block.raw.replace(/^##\s+/, '')}</h2>}
                              {block.level === 3 && <h3>{block.raw.replace(/^###\s+/, '')}</h3>}
                              {block.level && block.level > 3 && (
                                <h4 className="font-bold text-base mt-3 mb-1 text-slate-800">
                                  {block.raw.replace(/^#+\s+/, '')}
                                </h4>
                              )}
                            </div>
                          ) : block.type === 'table' ? (
                            /* Tables */
                            <div
                              className="overflow-x-auto my-3"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(block.raw) as string,
                              }}
                            />
                          ) : block.type === 'quote' ? (
                            /* Blockquotes */
                            <div
                              className="border-l-4 border-indigo-400 pl-4 italic text-slate-700 my-2"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(block.raw) as string,
                              }}
                            />
                          ) : block.type === 'list' ? (
                            /* Lists */
                            <div
                              className="my-2"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(block.raw) as string,
                              }}
                            />
                          ) : (
                            /* Paragraphs with full inline markdown links and formatting */
                            <div
                              className="leading-relaxed text-slate-800 text-[15px] my-1"
                              dangerouslySetInnerHTML={{
                                __html: marked.parse(block.raw) as string,
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom of Document Add Block Action */}
              <div className="mt-8 pt-4 border-t border-dashed border-slate-200 flex flex-col items-center">
                {insertingAtPosition?.position === 'end' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (insertPromptText.trim()) {
                        handleRequestInsertBlock(null, 'end', insertPromptText.trim());
                      }
                    }}
                    className="w-full rounded-xl border border-indigo-300 bg-indigo-50/70 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        Add Block to End of Document
                      </span>
                      <button
                        type="button"
                        onClick={() => setInsertingAtPosition(null)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={insertPromptText}
                        onChange={(e) => setInsertPromptText(e.target.value)}
                        placeholder='e.g., "Add a block linking the documents in docs", "Add a disaster recovery checklist"...'
                        className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={isInsertingAi || !insertPromptText.trim()}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        <Wand2 className="h-3 w-3" />
                        {isInsertingAi ? 'Generating...' : 'Add Block'}
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {[
                        'Add a block linking the documents in docs',
                        'Add a Mermaid sequence diagram',
                        'Add an architectural overview table',
                        'Add a disaster recovery checklist',
                      ].map((quick) => (
                        <button
                          key={quick}
                          type="button"
                          onClick={() => handleRequestInsertBlock(null, 'end', quick)}
                          className="rounded bg-white/90 border border-indigo-100 px-2 py-0.5 text-[10px] text-indigo-800 hover:bg-indigo-100 shadow-2xs font-medium"
                        >
                          {quick}
                        </button>
                      ))}
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setInsertingAtPosition({ targetBlockId: null, position: 'end' });
                      setInsertPromptText('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-2 text-xs font-medium text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Block with AI</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Full Document Sticky Prompt Bar (at bottom) */}
      <div className="border-t border-slate-200 bg-white/95 px-6 py-2.5 backdrop-blur-md z-20 shadow-lg">
        <form onSubmit={handleRequestGlobalReview} className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 shrink-0">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline">Whole Document Instruction:</span>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              value={globalPromptText}
              onChange={(e) => setGlobalPromptText(e.target.value)}
              placeholder='e.g., "number these headings", "move this section above Pricing", "make all headings title case"...'
              className="w-full rounded-xl border border-slate-300 bg-slate-50/80 px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={isGlobalAiLoading || !globalPromptText.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            {isGlobalAiLoading ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
            {isGlobalAiLoading ? 'Reviewing...' : 'Ask AI'}
          </button>
        </form>
      </div>

      {/* Floating Text Selection Toolbar */}
      <TextSelectionToolbar
        selectedText={selectedText}
        selectionCoords={selectionCoords}
        onSubmitPrompt={handleRequestSelectionReview}
        onClearSelection={() => {
          setSelectedText('');
          setSelectionCoords(null);
        }}
      />

      {/* Version History Drawer (Snapshots, Revert, Full Diff) */}
      <VersionHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        snapshots={snapshots}
        currentContent={markdownContent}
        onRevertToSnapshot={handleRevertToSnapshot}
        onCreateCheckpoint={handleCreateCheckpoint}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={aiConfig}
        onSaveConfig={setAiConfig}
      />

      {/* About & Quotes Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}

// Simple marked fallback helper for tables and lists
function renderMarkdownSimple(raw: string): string {
  // Simple table HTML generator if table
  if (raw.trim().startsWith('|')) {
    const lines = raw.trim().split('\n');
    if (lines.length >= 2) {
      let html = '<table class="w-full border-collapse my-3 text-xs"><thead><tr>';
      const headerCols = lines[0].split('|').filter((c) => c.trim() !== '');
      headerCols.forEach((col) => {
        html += `<th class="border border-slate-200 bg-slate-100 p-2 text-left font-semibold">${col.trim()}</th>`;
      });
      html += '</tr></thead><tbody>';

      // Skip separator line (line 1)
      for (let i = 2; i < lines.length; i++) {
        const rowCols = lines[i].split('|').filter((c) => c.trim() !== '');
        html += '<tr class="hover:bg-slate-50">';
        rowCols.forEach((col) => {
          html += `<td class="border border-slate-200 p-2">${col.trim()}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    }
  }

  // List HTML generator
  if (/^(\s*[-*+]|\s*\d+\.)\s+/.test(raw)) {
    const lines = raw.trim().split('\n');
    const isOrdered = /^\s*\d+\./.test(lines[0]);
    const tag = isOrdered ? 'ol' : 'ul';
    let html = `<${tag} class="my-2 pl-5 ${isOrdered ? 'list-decimal' : 'list-disc'} text-sm space-y-1">`;
    lines.forEach((line) => {
      const clean = line.replace(/^(\s*[-*+]|\s*\d+\.)\s+/, '');
      html += `<li>${clean}</li>`;
    });
    html += `</${tag}>`;
    return html;
  }

  return raw;
}
