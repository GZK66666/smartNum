import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '@/store';
import type { SessionListItem } from '@/types';

interface SessionSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onCreateSession: () => void;
  onSelectSession: (session: SessionListItem) => void;
}

export default function SessionSidebar({
  isCollapsed,
  onToggle,
  onCreateSession,
  onSelectSession,
}: SessionSidebarProps) {
  const {
    sessions,
    currentSession,
    currentDataSource,
    sessionsHasMore,
    sessionsIsLoading,
    fetchMoreSessions,
    refreshSessions,
    renameSession,
    deleteSessionFromList,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  // 加载会话列表（只在挂载时加载一次）
  useEffect(() => {
    if (!isCollapsed) {
      refreshSessions();
    }
  }, [isCollapsed]);

  // 无限滚动加载
  const handleScroll = useCallback(() => {
    const container = listEndRef.current?.parentElement;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // 距离底部 50px 时加载更多内容
    if (scrollTop + clientHeight >= scrollHeight - 50 && !sessionsIsLoading && sessionsHasMore) {
      fetchMoreSessions();
    }
  }, [sessionsIsLoading, sessionsHasMore, fetchMoreSessions]);

  useEffect(() => {
    const container = listEndRef.current?.parentElement;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 筛选会话
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return s.title?.toLowerCase().includes(query) ||
      s.datasource_name.toLowerCase().includes(query);
  });

  // 开始编辑标题
  const startEdit = (session: SessionListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingTitle(session.title || '');
  };

  // 保存标题
  const saveTitle = async (sessionId: string) => {
    if (editingTitle.trim()) {
      await renameSession(sessionId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  // 删除会话
  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      await deleteSessionFromList(sessionId);
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  // 折叠状态
  if (isCollapsed) {
    return (
      <div className="w-[52px] h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/30 flex flex-col items-center py-4 transition-all duration-300">
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-all duration-200"
          title="展开侧边栏"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onCreateSession}
          className="mt-2 p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-all duration-200"
          title="新建会话"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // 展开状态
  return (
    <div className="w-72 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/30 flex flex-col transition-all duration-300 ease-in-out">
      {/* 头部 */}
      <div className="h-12 px-3 border-b border-slate-700/30 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-medium text-slate-300">会话历史</h2>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-all duration-200"
          title="收起侧边栏"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* 新建按钮 */}
      <div className="p-3 border-b border-slate-700/30 flex-shrink-0">
        <button
          onClick={onCreateSession}
          disabled={!currentDataSource}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
        >
          <Plus className="w-4 h-4" />
          新建会话
        </button>
      </div>

      {/* 搜索框 */}
      <div className="p-3 border-b border-slate-700/30 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto flex-shrink-0">
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {searchQuery ? '没有找到匹配的会话' : '暂无会话记录'}
          </div>
        ) : (
          <div className="py-2">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={`group mx-2 mb-1 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  currentSession?.session_id === session.id
                    ? 'bg-gradient-to-r from-primary-600/20 to-primary-600/10 text-slate-100 border border-primary-500/30'
                    : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-colors duration-200 ${
                    currentSession?.session_id === session.id ? 'text-primary-400' : 'text-slate-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    {editingId === session.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTitle(session.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-sm text-slate-200 focus:outline-none focus:border-primary-500"
                          autoFocus
                        />
                        <button
                          onClick={() => saveTitle(session.id)}
                          className="p-1 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Check className="w-3 h-3 text-green-400" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 hover:bg-slate-700 rounded transition-colors">
                          <X className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">
                          {session.title || '新对话'}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {session.datasource_name}
                        </p>
                      </>
                    )}
                    <p className="text-xs text-slate-600 mt-1">
                      {formatTime(session.last_active_at)}
                    </p>
                  </div>
                  {/* 操作按钮 */}
                  {editingId !== session.id && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-200">
                      <button
                        onClick={(e) => startEdit(session, e)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                        title="重命名"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* 加载状态和列表结束标记 */}
            <div ref={listEndRef} className="py-2 flex justify-center">
              {sessionsIsLoading && (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>加载中...</span>
                </div>
              )}
              {!sessionsHasMore && sessions.length > 0 && (
                <p className="text-slate-600 text-xs">没有更多会话了</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
