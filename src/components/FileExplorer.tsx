import React, { useState, useRef, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  Layers,
  Search,
  Plus,
  FolderPlus,
  FilePlus,
  Edit2,
  Trash2,
  Copy,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  MoreVertical,
  Wand2,
} from 'lucide-react';
import { FileNode } from '../types';

interface FileExplorerProps {
  files: FileNode[];
  activeFileId: string;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (name: string, parentId?: string | null, templateType?: string) => void;
  onCreateFolder: (name: string, parentId?: string | null) => void;
  onRenameNode: (id: string, newName: string) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateFile: (id: string) => void;
  onToggleFolder: (id: string) => void;
}

export function FileExplorer({
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameNode,
  onDeleteNode,
  onDuplicateFile,
  onToggleFolder,
}: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Creation state: { type: 'file' | 'folder', parentId: string | null }
  const [isCreating, setIsCreating] = useState<{ type: 'file' | 'folder'; parentId: string | null } | null>(null);
  const [createName, setCreateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<'blank' | 'sequence' | 'flowchart' | 'state'>('blank');

  // Renaming state: nodeId being renamed
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when creating or renaming
  useEffect(() => {
    if (isCreating) {
      setTimeout(() => createInputRef.current?.focus(), 50);
    }
  }, [isCreating]);

  useEffect(() => {
    if (renamingId) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 50);
    }
  }, [renamingId]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.file-context-menu')) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartCreate = (type: 'file' | 'folder', targetFolderId?: string | null) => {
    setIsCreating({
      type,
      parentId: targetFolderId !== undefined ? targetFolderId : selectedFolderId,
    });
    setCreateName(type === 'file' ? 'new-document.md' : 'new-folder');
    setSelectedTemplate('blank');
    setActiveMenuId(null);
  };

  const handleConfirmCreate = () => {
    if (!isCreating || !createName.trim()) {
      setIsCreating(null);
      return;
    }
    const finalName = createName.trim();
    if (isCreating.type === 'file') {
      const ensuredName = finalName.includes('.') ? finalName : `${finalName}.md`;
      onCreateFile(ensuredName, isCreating.parentId, selectedTemplate);
    } else {
      onCreateFolder(finalName, isCreating.parentId);
    }
    setIsCreating(null);
    setCreateName('');
  };

  const handleCancelCreate = () => {
    setIsCreating(null);
    setCreateName('');
  };

  const handleStartRename = (node: FileNode) => {
    setRenamingId(node.id);
    setRenameValue(node.name);
    setActiveMenuId(null);
  };

  const handleConfirmRename = (id: string) => {
    if (renameValue.trim()) {
      onRenameNode(id, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  // Helper to determine file icon
  const getFileIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.endsWith('.mmd') || lower.endsWith('.mermaid')) {
      return <Layers className="h-3.5 w-3.5 text-purple-600 shrink-0" />;
    }
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />;
    }
    return <FileCode className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  };

  // Filter items matching query
  const filteredFiles = searchQuery.trim()
    ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  // Render a single node in tree
  const renderNode = (node: FileNode, depth = 0) => {
    const isFolder = node.type === 'folder';
    const isActive = activeFileId === node.id;
    const isRenaming = renamingId === node.id;
    const isMenuOpen = activeMenuId === node.id;

    // Children of this folder
    const children = files.filter((f) => f.parentId === node.id);

    return (
      <div key={node.id} className="select-none text-xs">
        {/* Node row */}
        <div
          onClick={() => {
            if (isFolder) {
              onToggleFolder(node.id);
              setSelectedFolderId(node.id);
            } else {
              onSelectFile(node.id);
              setSelectedFolderId(node.parentId || null);
            }
          }}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-md transition-colors cursor-pointer ${
            isActive && !isFolder
              ? 'bg-indigo-50 text-indigo-950 font-medium'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {/* Left item info */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isFolder ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolder(node.id);
                }}
                className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-transform"
              >
                {node.isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </span>
            ) : (
              <span className="w-3.5" />
            )}

            {/* Folder or File icon */}
            {isFolder ? (
              node.isOpen ? (
                <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              )
            ) : (
              getFileIcon(node.name)
            )}

            {/* Name or inline rename input */}
            {isRenaming ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmRename(node.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 flex-1"
              >
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="w-full rounded border border-indigo-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
                  title="Confirm rename"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200"
                  title="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            ) : (
              <span className="truncate flex-1" title={node.name}>
                {node.name}
              </span>
            )}

            {/* Modified indicator for unsaved work */}
            {node.isModified && !isFolder && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                title="Unsaved changes"
              />
            )}
          </div>

          {/* Quick Action buttons on hover */}
          {!isRenaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {isFolder && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCreate('file', node.id);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                    title="New File inside this folder"
                  >
                    <FilePlus className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartCreate('folder', node.id);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                    title="New Subfolder"
                  >
                    <FolderPlus className="h-3 w-3" />
                  </button>
                </>
              )}

              {/* Context menu toggle */}
              <div className="relative file-context-menu">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(isMenuOpen ? null : node.id);
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800"
                  title="More actions"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>

                {isMenuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg z-30"
                  >
                    <button
                      onClick={() => handleStartRename(node)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    >
                      <Edit2 className="h-3 w-3 text-slate-500" />
                      <span>Rename</span>
                    </button>

                    {!isFolder && (
                      <button
                        onClick={() => {
                          onDuplicateFile(node.id);
                          setActiveMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                      >
                        <Copy className="h-3 w-3 text-slate-500" />
                        <span>Duplicate</span>
                      </button>
                    )}

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      onClick={() => {
                        if (confirm(`Delete "${node.name}"${isFolder ? ' and all its contents' : ''}?`)) {
                          onDeleteNode(node.id);
                        }
                        setActiveMenuId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3 w-3 text-rose-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Inline Creation under this folder */}
        {isCreating && isCreating.parentId === node.id && (
          <div
            className="my-1 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2 text-xs"
            style={{ marginLeft: `${(depth + 1) * 14 + 8}px` }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              {isCreating.type === 'file' ? (
                <FilePlus className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span className="font-semibold text-indigo-950">
                New {isCreating.type === 'file' ? 'File' : 'Folder'}
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmCreate();
              }}
              className="space-y-1.5"
            >
              <input
                ref={createInputRef}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelCreate();
                }}
                placeholder={isCreating.type === 'file' ? 'filename.md' : 'folder-name'}
                className="w-full rounded border border-indigo-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
              />

              {isCreating.type === 'file' && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('blank')}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'blank'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Blank
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('sequence');
                      if (!createName.includes('.')) setCreateName('sequence-diagram.mmd');
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'sequence'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Sequence Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('flowchart');
                      if (!createName.includes('.')) setCreateName('system-flowchart.mmd');
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'flowchart'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Flowchart
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className="rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createName.trim()}
                  className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Children if folder is open */}
        {isFolder && node.isOpen && children.length > 0 && (
          <div>{children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  // Top-level root items (parentId is null)
  const rootNodes = searchQuery.trim()
    ? filteredFiles
    : files.filter((f) => !f.parentId);

  const fileCount = files.filter((f) => f.type === 'file').length;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Explorer Top Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 bg-slate-50/70">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Files
          </span>
          <span className="rounded bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-mono text-slate-600 tabular-nums">
            {fileCount}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => handleStartCreate('file', null)}
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-2xs"
            title="New File at workspace root"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleStartCreate('folder', null)}
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-2xs"
            title="New Folder at workspace root"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-7 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Inline Creation at workspace root */}
        {isCreating && isCreating.parentId === null && (
          <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 mb-1.5">
              {isCreating.type === 'file' ? (
                <FilePlus className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <FolderPlus className="h-3.5 w-3.5 text-amber-500" />
              )}
              <span className="font-semibold text-indigo-950">
                New {isCreating.type === 'file' ? 'File' : 'Folder'} (root)
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmCreate();
              }}
              className="space-y-2"
            >
              <input
                ref={createInputRef}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancelCreate();
                }}
                placeholder={isCreating.type === 'file' ? 'filename.md' : 'folder-name'}
                className="w-full rounded border border-indigo-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
              />

              {isCreating.type === 'file' && (
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate('blank')}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'blank'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Blank
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('sequence');
                      if (!createName.includes('.')) setCreateName('sequence-diagram.mmd');
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'sequence'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Sequence Diagram
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('flowchart');
                      if (!createName.includes('.')) setCreateName('system-flowchart.mmd');
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'flowchart'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Flowchart
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplate('state');
                      if (!createName.includes('.')) setCreateName('state-machine.mmd');
                    }}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                      selectedTemplate === 'state'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    State Machine
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={handleCancelCreate}
                  className="rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createName.trim()}
                  className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Empty state when search yields no results */}
        {searchQuery && rootNodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No files matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="space-y-0.5">
            {rootNodes.map((node) => renderNode(node, 0))}
          </div>
        )}
      </div>

      {/* Quick Status Footer */}
      <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 flex items-center justify-between">
        <span className="truncate">Workspace: <span className="font-medium text-slate-700">MarkSmith Project</span></span>
        <span className="font-mono text-[10px] text-slate-400">v1.2</span>
      </div>
    </div>
  );
}
