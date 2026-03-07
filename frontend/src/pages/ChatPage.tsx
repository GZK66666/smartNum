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
  Table,
  BarChart2,
  Brain,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '@/components/DataTable';
import ChartViewer from '@/components/ChartViewer';
import ThinkingProcess from '@/components/ThinkingProcess';
import ExportButton from '@/components/ExportButton';
import type { Message } from '@/types';

export default function ChatPage() {
  const {
    currentDataSource,
    currentSession,
    messages,
    isTyping,
    thinkingMessage,
    createSession,
    sendMessage,
    clearMessages,
  } = useAppStore();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize session when datasource is selected
  useEffect(() => {
    if (currentDataSource && !currentSession) {
      createSession(currentDataSource.id).catch(() => {
        toast.error('创建会话失败');
      });
    }
  }, [currentDataSource, currentSession, createSession]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  if (!currentDataSource) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Database className="w-16 h-16 text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">
          请先选择数据源
        </h3>
        <p className="text-slate-500 mb-6">
          选择一个数据库连接后开始智能问数
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Chat Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
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
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-primary-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-300 mb-2">
              开始提问
            </h3>
            <p className="text-slate-500 max-w-md">
              用自然语言描述您想查询的数据，例如：
              <br />
              <span className="text-slate-400">"查询上个月销售额前10的产品"</span>
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}

        {/* Typing Indicator */}
        {isTyping && (
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
      <div className="glass rounded-xl p-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题..."
            rows={1}
            className="flex-1 bg-transparent border-none resize-none text-slate-100 placeholder-slate-500 focus:outline-none"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="btn-primary px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('已复制到剪贴板');
  };

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="message-bubble message-user">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // 判断是否显示图表
  const showChart = message.visualization && message.result && message.result.rows.length > 0;

  return (
    <div className="flex justify-start space-y-3">
      <div className="message-bubble message-assistant max-w-full">
        {/* Agent Type Badge */}
        {message.agent_type && message.agent_type !== 'text2sql' && (
          <div className="mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              message.agent_type === 'chitchat'
                ? 'bg-blue-400/20 text-blue-300'
                : message.agent_type === 'analysis'
                ? 'bg-purple-400/20 text-purple-300'
                : 'bg-slate-600 text-slate-300'
            }`}>
              {message.agent_type === 'chitchat' ? '闲聊' : message.agent_type === 'analysis' ? '数据分析' : message.agent_type}
            </span>
          </div>
        )}

        {/* Thinking Process */}
        {message.thinking_process && message.thinking_process.length > 0 && (
          <ThinkingProcess events={message.thinking_process} />
        )}

        {/* Error */}
        {message.error && (
          <div className="text-red-400 mb-2">
            ⚠️ {message.error}
          </div>
        )}

        {/* Content */}
        {message.content && (
          <p className="text-slate-200 mb-3">{message.content}</p>
        )}

        {/* SQL */}
        {message.sql && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowSql(!showSql)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300"
              >
                <Code className="w-4 h-4" />
                {showSql ? '隐藏 SQL' : '显示 SQL'}
              </button>
            </div>
            {showSql && (
              <div className="relative">
                <pre className="sql-block text-xs overflow-x-auto">
                  <code>{message.sql}</code>
                </pre>
                <button
                  onClick={() => copyToClipboard(message.sql!)}
                  className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Analysis Result */}
        {message.analysis && (
          <div className="mb-3 p-3 bg-purple-400/10 border border-purple-400/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">数据分析</span>
            </div>
            <div className="space-y-2">
              {message.analysis.insights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-2 rounded border-l-2 ${
                    insight.importance === 'high'
                      ? 'border-red-400 bg-red-400/10'
                      : insight.importance === 'medium'
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-slate-400 bg-slate-700/50'
                  }`}
                >
                  <div className="text-sm font-medium text-slate-300">{insight.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{insight.content}</div>
                </div>
              ))}
              {message.analysis.recommendations.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">建议:</div>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {message.analysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-primary-400">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result Table/Chart */}
        {message.result && message.result.rows.length > 0 && (
          <div className="mt-3">
            {/* Tabs and Export */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    activeTab === 'table'
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Table className="w-4 h-4" />
                  表格
                </button>
                {showChart && (
                  <button
                    onClick={() => setActiveTab('chart')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      activeTab === 'chart'
                        ? 'bg-primary-500/20 text-primary-400'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    图表
                  </button>
                )}
              </div>
              <ExportButton
                data={message.result}
                filename={`query_${message.id}`}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
              <Table className="w-4 h-4" />
              <span>
                查询结果 · {message.result.total} 条记录
                {message.result.truncated && ' (已截断)'}
              </span>
            </div>

            {/* Content */}
            {activeTab === 'table' ? (
              <DataTable result={message.result} />
            ) : showChart ? (
              <ChartViewer
                data={message.result}
                suggestion={message.visualization!}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}