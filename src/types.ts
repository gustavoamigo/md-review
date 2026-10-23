export interface DocumentBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'code' | 'mermaid' | 'list' | 'table' | 'quote' | 'hr';
  raw: string;
  lineStart: number;
  lineEnd: number;
  level?: number;
  lang?: string;
}

export interface DocumentSnapshot {
  id: string;
  timestamp: number;
  label: string;
  author: 'ai' | 'user' | 'system';
  content: string;
  instruction?: string;
  additions: number;
  deletions: number;
}

export interface FeedbackItem {
  instruction: string;
  suggested: string;
  feedback?: string;
  timestamp: number;
}

export interface MermaidErrorContext {
  message: string;
  line?: number;
  column?: number;
  expected?: string[];
  offendingToken?: string;
  offendingText?: string;
  lineContent?: string;
  contextSnippet?: string;
  diagramType?: string;
  hints: string[];
}

export interface MermaidValidationResult {
  isValid: boolean;
  code: string;
  diagramType?: string;
  error?: string;
  errorContext?: MermaidErrorContext;
  sanitizedCode?: string;
  canAutoRecoverWithSanitizer?: boolean;
}

export interface ReviewProposal {
  id: string;
  blockId: string;
  instruction: string;
  originalText: string;
  suggestedText: string;
  status: 'pending' | 'accepted' | 'rejected';
  feedbackThread: FeedbackItem[];
  isDiagram: boolean;
  diagramError?: string | null;
  validationResult?: MermaidValidationResult;
  createdAt: number;
}

export interface ReviewComment {
  id: string;
  blockId: string;
  blockPreview: string;
  text: string;
  author: string;
  createdAt: number;
  resolved: boolean;
}

export interface AIProviderConfig {
  provider: 'gemini' | 'ollama' | 'openai-compatible';
  endpoint: string;
  model: string;
  apiKey?: string;
}

export interface SampleDocument {
  id: string;
  title: string;
  filename: string;
  badge: string;
  description: string;
  content: string;
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  parentId?: string | null;
  isOpen?: boolean;
  isModified?: boolean;
}

export interface WorkspaceFileSummary {
  id: string;
  name: string;
  path: string;
  folder: string;
  title: string;
  description: string;
  type: 'file' | 'folder';
}

