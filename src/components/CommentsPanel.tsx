import React, { useState } from 'react';
import { MessageSquare, Check, Trash2, Plus, CornerDownLeft, CheckCircle2 } from 'lucide-react';
import { ReviewComment } from '../types';

interface CommentsPanelProps {
  comments: ReviewComment[];
  activeBlockId: string | null;
  onAddComment: (blockId: string, text: string) => void;
  onToggleResolve: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  onScrollToBlock: (blockId: string) => void;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  comments,
  activeBlockId,
  onAddComment,
  onToggleResolve,
  onDeleteComment,
  onScrollToBlock,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  const filteredComments = comments.filter((c) => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeBlockId) return;
    onAddComment(activeBlockId, newCommentText.trim());
    setNewCommentText('');
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header and Filter */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Review Comments</h3>
            <span className="text-xs text-slate-500 font-mono">({comments.length})</span>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 rounded-md py-1 font-medium transition-colors ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`flex-1 rounded-md py-1 font-medium transition-colors ${
              filter === 'open' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Open ({comments.filter((c) => !c.resolved).length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`flex-1 rounded-md py-1 font-medium transition-colors ${
              filter === 'resolved' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Resolved ({comments.filter((c) => c.resolved).length})
          </button>
        </div>
      </div>

      {/* Add Comment on Selected Block */}
      {activeBlockId && (
        <form onSubmit={handleCreate} className="border-b border-slate-200 bg-indigo-50/40 p-3">
          <div className="text-[11px] font-semibold text-indigo-900 mb-1">
            Add Comment on Selected Block ({activeBlockId})
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Leave an engineering or prose review note..."
              className="flex-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredComments.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <MessageSquare className="mx-auto h-8 w-8 opacity-30 mb-2" />
            <p className="text-xs">No comments found in this view.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Select or hover a block and click 💬 to anchor a review note.
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div
              key={comment.id}
              onClick={() => onScrollToBlock(comment.blockId)}
              className={`cursor-pointer rounded-xl border p-3 text-xs transition-all hover:shadow-xs ${
                comment.resolved
                  ? 'border-slate-200 bg-slate-50/60 opacity-70'
                  : 'border-slate-200 bg-white hover:border-indigo-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span className="font-semibold text-slate-800">{comment.author}</span>
                <span>
                  {new Date(comment.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {comment.blockPreview && (
                <div className="mb-2 line-clamp-1 border-l-2 border-slate-300 pl-2 font-mono text-[11px] text-slate-500 italic">
                  "{comment.blockPreview}"
                </div>
              )}

              <p className={`text-slate-800 leading-normal ${comment.resolved ? 'line-through text-slate-400' : ''}`}>
                {comment.text}
              </p>

              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleResolve(comment.id);
                  }}
                  className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    comment.resolved ? 'text-emerald-700 hover:text-emerald-800' : 'text-slate-500 hover:text-emerald-600'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {comment.resolved ? 'Resolved' : 'Mark Resolved'}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteComment(comment.id);
                  }}
                  className="text-slate-400 hover:text-red-600 p-1 rounded"
                  title="Delete Comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
