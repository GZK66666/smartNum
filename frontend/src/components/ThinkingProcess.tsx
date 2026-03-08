import { useState, useEffect } from 'react';
import {
  Brain,
  Wrench,
  Database,
  Code,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Route,
  Lightbulb,
  List,
} from 'lucide-react';
import type { ThinkingEvent } from '@/types';

interface ThinkingProcessProps {
  events: ThinkingEvent[];
  collapsed?: boolean;
  isStreaming?: boolean;  // 是否正在流式输出
}

// 事件图标
const EventIcon: Record<string, React.ReactNode> = {
  route: <Route className="w-4 h-4 text-purple-400" />,
  thinking: <Brain className="w-4 h-4 text-blue-400" />,
  tool_call: <Wrench className="w-4 h-4 text-yellow-400" />,
  tool_result: <Database className="w-4 h-4 text-green-400" />,
  sql_generation: <Code className="w-4 h-4 text-cyan-400" />,
  sql_execution: <Database className="w-4 h-4 text-orange-400" />,
  visualization: <Lightbulb className="w-4 h-4 text-pink-400" />,
  result: <CheckCircle className="w-4 h-4 text-green-400" />,
  message: <CheckCircle className="w-4 h-4 text-blue-400" />,
  analysis: <Lightbulb className="w-4 h-4 text-purple-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  done: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  plan: <List className="w-4 h-4 text-indigo-400" />,
};

// 事件标签
const EventLabel: Record<string, string> = {
  route: '路由判断',
  thinking: '思考中',
  tool_call: '调用工具',
  tool_result: '工具结果',
  sql_generation: 'SQL 生成',
  sql_execution: 'SQL 执行',
  visualization: '可视化建议',
  result: '查询结果',
  message: '回复消息',
  analysis: '数据分析',
  error: '错误',
  done: '完成',
  plan: '任务规划',
};

export default function ThinkingProcess({
  events,
  collapsed: collapsedProp = false,
  isStreaming = false,
}: ThinkingProcessProps) {
  // 当 isStreaming 变化时，重置 collapsed 状态
  const [collapsed, setCollapsed] = useState(collapsedProp);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // 当 isStreaming 变化或 collapsedProp 变化时，更新 collapsed 状态
  useEffect(() => {
    setCollapsed(collapsedProp);
  }, [collapsedProp]);

  // 自动滚动到最新事件
  useEffect(() => {
    if (isStreaming && !collapsed) {
      const container = document.getElementById('thinking-events-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [events, isStreaming, collapsed]);

  // 切换工具详情展开
  const toggleToolExpand = (id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 检查某个工具调用是否已完成（是否有对应的 tool_result）
  const isToolCompleted = (toolCallId: string, toolName: string, index: number): boolean => {
    // 对于 run_sql，检查是否有 sql_execution completed 事件
    if (toolName === 'run_sql') {
      for (let i = index + 1; i < events.length; i++) {
        const e = events[i];
        if (e.type === 'sql_execution' && e.status === 'completed') {
          return true;
        }
      }
    }
    // 对于其他工具，检查是否有 tool_result
    for (let i = index + 1; i < events.length; i++) {
      const e = events[i];
      if (e.type === 'tool_result' && e.tool === toolName) {
        return true;
      }
    }
    // 如果流式已结束，认为已完成
    return !isStreaming;
  };

  // 渲染单个事件
  const renderEvent = (event: ThinkingEvent, index: number) => {
    const isLast = index === events.length - 1;
    const isToolExpanded = event.id && expandedTools.has(event.id);

    // 对于 tool_call，检查是否已完成
    let toolCompleted = false;
    if (event.type === 'tool_call' && event.tool) {
      toolCompleted = isToolCompleted(event.id || '', event.tool, index);
    }

    // 对于 sql_execution，检查状态
    // 如果流式已结束且状态是 running，也显示为完成
    const eventStatus = event.status;
    const isSQLRunning = event.type === 'sql_execution' && eventStatus === 'running' && isStreaming;
    const isSQLCompleted = event.type === 'sql_execution' && (eventStatus === 'completed' || (!isStreaming && eventStatus === 'running'));

    return (
      <div
        key={index}
        className={`flex items-start gap-3 ${isLast ? '' : 'mb-3'}`}
      >
        {/* 时间线 */}
        <div className="flex flex-col items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              event.type === 'error'
                ? 'bg-red-400/20'
                : event.type === 'done' || isSQLCompleted || toolCompleted
                ? 'bg-emerald-400/20'
                : isSQLRunning || (event.type === 'tool_call' && !toolCompleted && isStreaming)
                ? 'bg-yellow-400/20 animate-pulse'
                : 'bg-slate-700'
            }`}
          >
            {isSQLRunning ? (
              <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
            ) : isSQLCompleted ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : EventIcon[event.type] ? (
              EventIcon[event.type]
            ) : (
              <Brain className="w-4 h-4 text-slate-400" />
            )}
          </div>
          {!isLast && <div className="w-0.5 h-full bg-slate-700 mt-1" />}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-slate-300">
              {EventLabel[event.type] || event.type}
            </span>
            {event.type === 'route' && event.agent && (
              <span className="text-xs px-2 py-0.5 bg-purple-400/20 text-purple-300 rounded-full">
                {event.agent}
              </span>
            )}
            {event.confidence && (
              <span className="text-xs text-slate-500">
                {(event.confidence * 100).toFixed(0)}% 置信度
              </span>
            )}
            {/* 工具调用状态指示 */}
            {event.type === 'tool_call' && event.tool && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                toolCompleted
                  ? 'bg-green-400/20 text-green-300'
                  : isStreaming
                  ? 'bg-yellow-400/20 text-yellow-300'
                  : 'bg-slate-600 text-slate-400'
              }`}>
                {toolCompleted ? '已完成' : isStreaming ? '执行中...' : '调用'}
              </span>
            )}
          </div>

          {/* 思考内容 */}
          {event.content && (
            <p className="text-sm text-slate-400">{event.content}</p>
          )}

          {/* 工具调用 */}
          {event.type === 'tool_call' && event.tool && (
            <div className="mt-2">
              <button
                onClick={() => event.id && toggleToolExpand(event.id)}
                className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300"
              >
                {isToolExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">
                  {event.tool}
                </code>
              </button>
              {isToolExpanded && event.input && (
                <div className="mt-1 ml-4 p-2 bg-slate-800/50 rounded text-xs text-slate-400">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(event.input, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 工具结果 */}
          {event.type === 'tool_result' && event.tool && (
            <div className="mt-1 ml-4">
              <div className="text-xs text-slate-500 mb-1">输出:</div>
              <div className="p-2 bg-slate-800/50 rounded text-xs text-slate-400 max-h-32 overflow-auto">
                {event.output || '无输出'}
              </div>
            </div>
          )}

          {/* SQL */}
          {event.type === 'sql_generation' && event.sql && (
            <div className="mt-1 p-2 bg-slate-800/50 rounded overflow-x-auto">
              <pre className="text-xs text-cyan-400">{event.sql}</pre>
            </div>
          )}

          {/* SQL 执行状态 */}
          {event.type === 'sql_execution' && (
            <div className="mt-1 flex items-center gap-2 text-xs">
              {isSQLRunning ? (
                <span className="flex items-center gap-1 text-orange-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  执行中...
                </span>
              ) : isSQLCompleted ? (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  执行完成
                  {event.duration && <span>({event.duration.toFixed(2)}s)</span>}
                </span>
              ) : null}
            </div>
          )}

          {/* 错误 */}
          {event.type === 'error' && (event.message || event.error) && (
            <div className="mt-1 p-2 bg-red-400/10 border border-red-400/20 rounded text-sm text-red-400">
              {event.message || event.error}
            </div>
          )}

          {/* 洞察 */}
          {event.type === 'analysis' && event.insights && (
            <div className="mt-2 space-y-2">
              {event.insights.map((insight, i) => (
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
                  <div className="text-sm font-medium text-slate-300">
                    {insight.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {insight.content}
                  </div>
                </div>
              ))}
              {event.recommendations && event.recommendations.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">建议:</div>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {event.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-primary-400">•</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 计算事件统计
  const eventStats = {
    total: events.length,
    tools: events.filter((e) => e.type === 'tool_call').length,
    errors: events.filter((e) => e.type === 'error').length,
  };

  return (
    <div className="my-3">
      {/* 标题栏 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-slate-400">
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <Brain className="w-4 h-4" />
          <span>智能体思考过程</span>
          {isStreaming && (
            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
          )}
          {!collapsed && (
            <span className="text-xs text-slate-500">
              ({eventStats.total} 步骤, {eventStats.tools} 次工具调用)
            </span>
          )}
        </div>
        {eventStats.errors > 0 && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {eventStats.errors} 个错误
          </span>
        )}
      </button>

      {/* 事件列表 */}
      {!collapsed && events.length > 0 && (
        <div
          id="thinking-events-container"
          className="mt-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 max-h-96 overflow-y-auto"
        >
          {events.map((event, index) => renderEvent(event, index))}
        </div>
      )}
    </div>
  );
}