import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import {
  Send,
  Loader2,
  Trash2,
  Copy,
  Check,
  Database,
  Code,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ThinkingProcess from '@/components/ThinkingProcess';
import ChartRenderer from '@/components/ChartRenderer';
import ExportCard from '@/components/ExportCard';
import SessionSidebar from '@/components/SessionSidebar';
import type { Message, ContentBlock, SessionListItem } from '@/types';

// 过滤思考内容 (<think>...</think> 标签)
function filterThinkingContent(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export default function ChatPage() {
  const {
    currentDataSource,
    currentSession,
    messages,
    isTyping,
    thinkingMessage,
    thinkingEvents,
    
    setCurrentSession,
    fetchMessages,
    fetchSessions,
    refreshSessions,
    sendMessage,
    clearMessages,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 加载会话列表（只在组件挂载时加载一次）
  useEffect(() => {
    fetchSessions(undefined, true);
  }, []);

  // 当数据源变化时，重新加载会话列表
  useEffect(() => {
    if (currentDataSource) {
      refreshSessions();
    }
  }, [currentDataSource?.id]);


  // 实时滚动到最新内容
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinkingEvents]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const message = input.trim();
    setInput('');

    try {
      await sendMessage(message);
    } catch {
      // Error handled in store
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (confirm('确定要清空对话记录吗？')) {
      clearMessages();
    }
  };

  // 创建新会话 - 只清空当前会话状态，实际会话在发送第一条消息时创建
  const handleCreateSession = () => {
    clearMessages();
    setCurrentSession(null);
    // 不立即调用 createSession，等用户发送第一条消息时再创建
  };

  // 选择会话
  const handleSelectSession = async (session: SessionListItem) => {
    // 设置当前会话
    setCurrentSession({
      session_id: session.id,
      datasource_id: session.datasource_id,
      created_at: session.created_at,
    });

    // 加载历史消息
    try {
      await fetchMessages(session.id);
    } catch {
      toast.error('加载消息失败');
    }
  };

  // 未选择数据源时的提示
  if (!currentDataSource) {
    return (
      <div className="flex h-full">
        {/* 侧边栏 */}
        <SessionSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCreateSession={handleCreateSession}
          onSelectSession={handleSelectSession}
        />

        {/* 主内容区 */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900/30">
          <Database className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            请先选择数据源
          </h3>
          <p className="text-slate-500 mb-6">
            选择一个数据库连接后开始智能问数
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 侧边栏 */}
      <SessionSidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onCreateSession={handleCreateSession}
        onSelectSession={handleSelectSession}
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/30 h-full overflow-hidden">
        {/* Chat Header */}
        <div className="flex items-center justify-between py-4 px-6 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-medium text-slate-100">{currentDataSource.name}</h3>
              <p className="text-sm text-slate-500">
                {currentDataSource.type.toUpperCase()} · {currentDataSource.database}
              </p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-400/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空对话
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex-shrink-0 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-6">
                <Send className="w-10 h-10 text-primary-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                开始提问
              </h3>
              <p className="text-slate-500 max-w-md">
                用自然语言描述您想查询的数据，例如：
                <br />
                <span className="text-slate-400">"查询上个月销售额前 10 的产品"</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}

          {/* 实时展示思考过程 */}
          {isTyping && thinkingEvents.length > 0 && (
            <div className="message-bubble message-assistant max-w-full">
              <ThinkingProcess
                events={thinkingEvents}
                isStreaming={true}
                collapsed={false}
              />
            </div>
          )}

          {/* 兼容：如果没有 thinkingEvents 但正在 typing */}
          {isTyping && thinkingEvents.length === 0 && (
            <div className="message-bubble message-assistant">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{thinkingMessage || '思考中...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="glass rounded-xl p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的问题..."
                rows={1}
                className="flex-1 bg-transparent border-none resize-none text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0"
                style={{ minHeight: '24px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="btn-primary px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Bubble
function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('已复制到剪贴板');
  };

  if (message.role === 'user') {
    const content = message.blocks?.find(b => b.type === 'text')?.content || '';
    return (
      <div className="flex justify-end animate-fade-in-up">
        <div className="message-bubble message-user max-w-[85%]">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in-up">
      <div className="message-bubble message-assistant max-w-[85%]">
        {message.thinking_process && message.thinking_process.length > 0 && (
          <ThinkingProcess
            events={message.thinking_process}
            isStreaming={false}
            collapsed={true}
          />
        )}

        {message.error && (
          <div className="text-red-400 mb-2">⚠️ {message.error}</div>
        )}

        {message.sql && (
          <div className="mb-3">
            <button
              onClick={() => setShowSql(!showSql)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <Code className="w-4 h-4" />
              {showSql ? '隐藏 SQL' : '显示 SQL'}
            </button>
            {showSql && (
              <div className="relative mt-2">
                <pre className="sql-block text-xs overflow-x-auto">
                  <code>{message.sql}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(message.sql!)}
                  className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              </div>
            )}
          </div>
        )}

        {message.blocks?.map((block, index) => (
          <ContentBlockRenderer key={index} block={block} />
        ))}
      </div>
    </div>
  );
}

// Content Block Renderer
function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  if (block.type === 'text') {
    // 过滤思考内容
    const filteredContent = filterThinkingContent(block.content);
    return (
      <div className="prose prose-invert prose-sm max-w-none text-slate-200 mb-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {filteredContent}
        </ReactMarkdown>
      </div>
    );
  }

  if (block.type === 'chart') {
    return (
      <ChartRenderer
        chartType={block.chartType}
        title={block.title}
        option={block.option}
      />
    );
  }

  if (block.type === 'export') {
    return (
      <ExportCard
        filename={block.filename}
        format={block.format}
        size={block.size}
        downloadId={block.downloadId}
        rowCount={block.rowCount}
        columnCount={block.columnCount}
      />
    );
  }

  return null;
}
