import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Send,
  Plus,
  Trash2,
  Database,
  Loader2,
  Sparkles,
  ChevronDown,
  Table,
  MoreHorizontal,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { sessionApi, datasourceApi, createAgentMessageStream, filterThinkingContent } from '../services/api'
import AgentSteps from '../components/AgentSteps'
import ChartRenderer from '../components/ChartRenderer'
import ExportCard from '../components/ExportCard'
import type { Session, Message, DataSource, AgentStep, AgentStepEvent } from '../types'

export default function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // 从 URL 获取 datasourceId（用于草稿状态）
  const datasourceIdFromUrl = searchParams.get('datasource')

  // 消息列表
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDatasourceSelect, setShowDatasourceSelect] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)

  // 流式状态 - 仅用于跟踪当前流式内容
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingSteps, setStreamingSteps] = useState<AgentStep[]>([])
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const streamingContentRef = useRef('')
  const streamingStepsRef = useRef<AgentStep[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch datasources
  const { data: datasources = [] } = useQuery({
    queryKey: ['datasources'],
    queryFn: datasourceApi.list,
  })

  // Fetch sessions
  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(undefined, 50),
  })

  const sessions = sessionsData?.data || []
  const currentSession = sessions.find((s: Session) => s.id === sessionId)

  // 获取当前选中的数据源
  const currentDatasourceId = sessionId
    ? currentSession?.datasource_id
    : datasourceIdFromUrl

  const currentDatasource = datasources.find((ds: DataSource) => ds.id === currentDatasourceId)

  // 是否处于草稿模式
  const isDraftMode = !sessionId && !!datasourceIdFromUrl

  // 是否正在流式传输（包括等待响应阶段）
  const isStreaming = isWaitingForResponse || streamingContent !== '' || streamingSteps.length > 0

  // 正在创建的会话 ID（用于避免在导航后重新加载消息）
  const creatingSessionIdRef = useRef<string | null>(null)

  // 合并 tool_call 和 tool_result 步骤
  const mergeAgentSteps = useCallback((steps: AgentStep[]): AgentStep[] => {
    if (!steps || steps.length === 0) return []

    const merged: AgentStep[] = []
    const pendingToolCalls = new Map<string, AgentStep>()

    for (const step of steps) {
      // 只处理 tool_call 和 tool_result，过滤掉 message 等其他类型
      if (step.type !== 'tool_call' && step.type !== 'tool_result') {
        continue
      }

      if (step.type === 'tool_call') {
        // 后端存储的是 input 字段，转为 details
        const inputDetails = step.input
          ? (typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2))
          : (step.details || '')

        const newStep: AgentStep = {
          ...step,
          id: step.id || `${step.type}-${step.tool || step.name}-${Date.now()}`,
          details: inputDetails,
          status: 'running',
        }
        pendingToolCalls.set(step.tool || step.name, newStep)
        merged.push(newStep)
      } else if (step.type === 'tool_result') {
        // 找到对应的 tool_call 并更新
        const toolName = step.tool || step.name
        const pendingStep = pendingToolCalls.get(toolName)
        if (pendingStep) {
          // 后端存储的是 output 字段
          const outputDetails = step.output || step.details || step.content || ''
          const inputDetails = pendingStep.details || ''
          pendingStep.status = 'completed'
          pendingStep.details = inputDetails
            ? `【输入】\n${inputDetails}\n\n【输出】\n${outputDetails}`
            : outputDetails
          pendingToolCalls.delete(toolName)
        }
      }
    }

    return merged
  }, [])

  // Fetch messages when session changes
  useEffect(() => {
    // 如果是正在创建的会话，跳过消息加载（消息已在本地管理）
    if (sessionId && sessionId === creatingSessionIdRef.current) {
      creatingSessionIdRef.current = null // 重置标记
      return
    }

    if (sessionId) {
      setIsLoading(true)
      sessionApi.getMessages(sessionId)
        .then((msgs) => {
          // 处理历史消息中的 agentSteps
          const processedMsgs = (msgs as Message[]).map((msg) => ({
            ...msg,
            agentSteps: msg.agentSteps ? mergeAgentSteps(msg.agentSteps) : undefined,
          }))
          setMessages(processedMsgs)
        })
        .finally(() => setIsLoading(false))
    } else {
      setMessages([])
    }
  }, [sessionId, mergeAgentSteps])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Delete session
  const deleteSessionMutation = useMutation({
    mutationFn: sessionApi.delete,
    onSuccess: () => {
      refetchSessions()
      if (sessionId) {
        navigate('/chat')
      }
    },
  })

  // Handle send message
  const handleSend = useCallback(async () => {
    const datasourceId = sessionId ? currentSession?.datasource_id : datasourceIdFromUrl

    if (!input.trim()) return
    if (!datasourceId) {
      setShowDatasourceSelect(true)
      return
    }

    const userMessage = input.trim()
    setInput('')

    // 创建会话（如果是草稿模式）
    let targetSessionId = sessionId
    if (!targetSessionId) {
      try {
        const newSession = await sessionApi.create(datasourceId)
        targetSessionId = newSession.id
        // 标记正在创建的会话，避免 useEffect 重新加载消息
        creatingSessionIdRef.current = targetSessionId
        navigate(`/chat/${targetSessionId}`, { replace: true })
        refetchSessions()
      } catch (error) {
        console.error('创建会话失败:', error)
        setInput(userMessage)
        return
      }
    }

    // 立即添加用户消息到列表
    const userMsgId = `user-${Date.now()}`
    const aiMsgId = `ai-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        blocks: [{ type: 'text', content: userMessage }],
        created_at: new Date().toISOString(),
      },
    ])

    // 重置流式状态
    streamingContentRef.current = ''
    streamingStepsRef.current = []
    setStreamingContent('')
    setStreamingSteps([])
    setIsWaitingForResponse(true)  // 开始等待响应

    // 开始流式请求
    createAgentMessageStream(targetSessionId!, userMessage, {
      onContent: (content) => {
        streamingContentRef.current += content
        setStreamingContent(streamingContentRef.current)
      },
      onStep: (event: AgentStepEvent) => {
        // 过滤掉 thinking 事件
        if (event.type === 'thinking') return

        // 如果是 tool_result，更新对应的 tool_call 步骤状态
        if (event.type === 'tool_result') {
          const toolName = event.tool || event.name
          streamingStepsRef.current = streamingStepsRef.current.map((step) => {
            // 找到对应的 tool_call 步骤（同一个工具且状态为 running）
            if (step.type === 'tool_call' && step.tool === toolName && step.status === 'running') {
              const inputDetails = step.details || ''
              const outputDetails = event.output || ''
              // 同时展示输入和输出
              const combinedDetails = inputDetails
                ? `【输入】\n${inputDetails}\n\n【输出】\n${outputDetails}`
                : outputDetails
              return {
                ...step,
                status: 'completed' as const,
                details: combinedDetails,
              }
            }
            return step
          })
          setStreamingSteps([...streamingStepsRef.current])
          return
        }

        // 其他事件类型，创建新步骤
        const stepId = `${event.type}-${event.tool || event.name || ''}-${Date.now()}`
        const step: AgentStep = {
          id: stepId,
          type: event.type,
          name: event.name || event.tool || event.type,
          status: event.status || 'running',
          content: event.content || '',
          details: event.output || event.details || '',
          sql: event.sql || '',
          result: event.result,
          tool: event.tool || '',
          timestamp: Date.now(),
        }

        // 如果是 tool_call，把 input 作为 details
        if (event.type === 'tool_call' && event.input) {
          step.details = JSON.stringify(event.input, null, 2)
          if (event.tool === 'run_sql' && event.input.sql) {
            step.sql = event.input.sql as string
          }
        }

        streamingStepsRef.current = [...streamingStepsRef.current, step]
        setStreamingSteps([...streamingStepsRef.current])
      },
      onError: (error) => {
        // 添加错误消息
        setMessages((prev) => [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            blocks: [{ type: 'text', content: `错误: ${error}` }],
            created_at: new Date().toISOString(),
          },
        ])
        // 清除流式状态
        setStreamingContent('')
        setStreamingSteps([])
        setIsWaitingForResponse(false)  // 停止等待
      },
      onComplete: () => {
        // 将流式内容转为正式消息
        if (streamingContentRef.current) {
          const completedSteps = streamingStepsRef.current.map((s) => ({
            ...s,
            status: 'completed' as const,
          }))

          setMessages((prev) => [
            ...prev,
            {
              id: aiMsgId,
              role: 'assistant',
              blocks: [{ type: 'text', content: streamingContentRef.current }],
              agentSteps: completedSteps,
              created_at: new Date().toISOString(),
            },
          ])
        }

        // 清除流式状态
        setStreamingContent('')
        setStreamingSteps([])
        setIsWaitingForResponse(false)  // 停止等待

        // 刷新会话列表以更新标题
        setTimeout(() => refetchSessions(), 500)
      },
    })
  }, [input, sessionId, currentSession, datasourceIdFromUrl, navigate, refetchSessions])

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Select datasource
  const handleSelectDatasource = (ds: DataSource) => {
    navigate(`/chat?datasource=${ds.id}`)
    setShowDatasourceSelect(false)
  }

  return (
    <div className="flex h-screen">
      {/* Sessions Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-dark-800/50 backdrop-blur-xl border-r border-white/5 flex flex-col overflow-hidden"
          >
            <div className="p-4">
              <button
                onClick={() => setShowDatasourceSelect(true)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                新对话
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
              {sessions.map((session: Session) => (
                <button
                  key={session.id}
                  onClick={() => navigate(`/chat/${session.id}`)}
                  className={`w-full text-left p-3 rounded-xl mb-1 transition-all group ${
                    sessionId === session.id
                      ? 'bg-accent-primary/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">
                        {session.title || '新对话'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {session.message_count} 条消息
                      </p>
                    </div>
                    {sessionId === session.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSessionMutation.mutate(session.id)
                        }}
                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-dark-800/30 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {(currentSession || currentDatasource) && (
              <>
                <Database className="w-4 h-4 text-accent-primary" />
                <span className="text-gray-300">
                  {currentSession?.datasource_name || currentDatasource?.name}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!sessionId && !isDraftMode ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center mx-auto mb-6 shadow-glow">
                  <Sparkles className="w-10 h-10 text-dark-900" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-2">
                  开始智能对话
                </h2>
                <p className="text-gray-400 mb-6">
                  选择数据源，用自然语言查询数据
                </p>
                <button
                  onClick={() => setShowDatasourceSelect(true)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  新建对话
                </button>
              </div>
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                {isLoading ? (
                  <Loader2 className="w-8 h-8 text-accent-primary animate-spin mx-auto" />
                ) : (
                  <p className="text-gray-400">发送消息开始对话</p>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-6 px-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-6 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-[80%] bg-accent-primary/10 border border-accent-primary/20 rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-white whitespace-pre-wrap">
                        {msg.blocks[0]?.content}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {msg.agentSteps && msg.agentSteps.length > 0 && (
                        <AgentSteps steps={msg.agentSteps} isStreaming={false} />
                      )}
                      {(() => {
                        // 检查是否是可视化请求（有 render_chart 步骤）
                        const hasChart = msg.agentSteps?.some(step => step.tool === 'render_chart' || step.name === 'render_chart')
                        // 检查是否是导出请求（有 export_data 步骤）
                        const hasExport = msg.agentSteps?.some(step => step.tool === 'export_data' || step.name === 'export_data')

                        if (hasChart) {
                          // 可视化请求：只渲染图表
                          const chartStep = msg.agentSteps?.find(step => step.tool === 'render_chart' || step.name === 'render_chart')
                          if (chartStep?.details) {
                            const outputMatch = chartStep.details.match(/【输出】\n([\s\S]*)/)
                            if (outputMatch) {
                              try {
                                const chartData = JSON.parse(outputMatch[1])
                                if (chartData.option) {
                                  return (
                                    <ChartRenderer
                                      chartType={chartData.chart_type || 'bar'}
                                      title={chartData.title || '图表'}
                                      option={chartData.option}
                                    />
                                  )
                                }
                              } catch (e) {
                                console.error('解析图表数据失败:', e)
                              }
                            }
                          }
                          return null
                        }

                        if (hasExport) {
                          // 导出请求：只渲染下载卡片
                          const exportStep = msg.agentSteps?.find(step => step.tool === 'export_data' || step.name === 'export_data')
                          if (exportStep?.details) {
                            const outputMatch = exportStep.details.match(/【输出】\n([\s\S]*)/)
                            if (outputMatch) {
                              try {
                                const exportData = JSON.parse(outputMatch[1])
                                if (exportData.download_id) {
                                  return (
                                    <ExportCard
                                      filename={exportData.filename || 'export'}
                                      format={exportData.format || 'csv'}
                                      size={exportData.size || 0}
                                      downloadId={exportData.download_id}
                                      rowCount={exportData.row_count || 0}
                                      columnCount={exportData.column_count || 0}
                                    />
                                  )
                                }
                              } catch (e) {
                                console.error('解析导出数据失败:', e)
                              }
                            }
                          }
                          return null
                        }

                        // 非可视化/导出请求：正常显示查询结果和文字
                        return (
                          <>
                            {msg.result?.columns && msg.result?.rows && (
                              <div className="glass-card overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                                  <Table className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-400">查询结果</span>
                                  <span className="text-xs text-gray-500 ml-auto">
                                    {msg.result.total} 行{msg.result.truncated && ' (已截断)'}
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-white/5">
                                        {msg.result.columns.map((col) => (
                                          <th key={col} className="px-4 py-2 text-left text-gray-400 font-medium">
                                            {col}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msg.result.rows.slice(0, 10).map((row, i) => (
                                        <tr key={i} className="border-b border-white/5 last:border-0">
                                          {Array.isArray(row) && row.map((cell, j) => (
                                            <td key={j} className="px-4 py-2 text-gray-300">
                                              {String(cell ?? 'NULL')}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {msg.result.rows.length > 10 && (
                                    <div className="px-4 py-2 text-center text-gray-500 text-sm border-t border-white/5">
                                      还有 {msg.result.rows.length - 10} 行...
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {msg.blocks[0]?.content && (
                              <div className="markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {filterThinkingContent(msg.blocks[0].content)}
                                </ReactMarkdown>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </motion.div>
              ))}

              {/* 流式内容 - 作为独立区块显示 */}
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <AgentSteps steps={streamingSteps} isStreaming={true} />
                  {(() => {
                    // 检查是否是可视化请求
                    const hasChart = streamingSteps.some(step => step.tool === 'render_chart' || step.name === 'render_chart')
                    // 检查是否是导出请求
                    const hasExport = streamingSteps.some(step => step.tool === 'export_data' || step.name === 'export_data')

                    if (hasChart) {
                      // 可视化请求：只渲染图表（完成后）
                      const chartStep = streamingSteps.find(step => step.tool === 'render_chart' || step.name === 'render_chart')
                      if (chartStep?.details && chartStep.status === 'completed') {
                        const outputMatch = chartStep.details.match(/【输出】\n([\s\S]*)/)
                        if (outputMatch) {
                          try {
                            const chartData = JSON.parse(outputMatch[1])
                            if (chartData.option) {
                              return (
                                <ChartRenderer
                                  chartType={chartData.chart_type || 'bar'}
                                  title={chartData.title || '图表'}
                                  option={chartData.option}
                                />
                              )
                            }
                          } catch (e) {
                            console.error('解析图表数据失败:', e)
                          }
                        }
                      }
                      return null
                    }

                    if (hasExport) {
                      // 导出请求：只渲染下载卡片（完成后）
                      const exportStep = streamingSteps.find(step => step.tool === 'export_data' || step.name === 'export_data')
                      if (exportStep?.details && exportStep.status === 'completed') {
                        const outputMatch = exportStep.details.match(/【输出】\n([\s\S]*)/)
                        if (outputMatch) {
                          try {
                            const exportData = JSON.parse(outputMatch[1])
                            if (exportData.download_id) {
                              return (
                                <ExportCard
                                  filename={exportData.filename || 'export'}
                                  format={exportData.format || 'csv'}
                                  size={exportData.size || 0}
                                  downloadId={exportData.download_id}
                                  rowCount={exportData.row_count || 0}
                                  columnCount={exportData.column_count || 0}
                                />
                              )
                            }
                          } catch (e) {
                            console.error('解析导出数据失败:', e)
                          }
                        }
                      }
                      return null
                    }

                    // 非可视化/导出请求：显示文字内容
                    return streamingContent && (
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {filterThinkingContent(streamingContent)}
                        </ReactMarkdown>
                      </div>
                    )
                  })()}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {(sessionId || isDraftMode) && (
          <div className="p-4 border-t border-white/5 bg-dark-800/30 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto">
              <div className="glass-card p-2 flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入您的问题..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none outline-none px-3 py-2 max-h-40"
                  rows={1}
                  style={{ height: 'auto', minHeight: '44px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  className="p-3 bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-900 rounded-xl font-medium hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStreaming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Datasource Select Modal */}
      <AnimatePresence>
        {showDatasourceSelect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDatasourceSelect(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl font-semibold text-white">选择数据源</h3>
                <button
                  onClick={() => setShowDatasourceSelect(false)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {datasources.length > 0 ? (
                <div className="space-y-2">
                  {datasources.map((ds: DataSource) => (
                    <button
                      key={ds.id}
                      onClick={() => handleSelectDatasource(ds)}
                      className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all flex items-center gap-3"
                    >
                      <Database className="w-5 h-5 text-accent-primary" />
                      <div className="text-left flex-1">
                        <p className="font-medium text-white">{ds.name}</p>
                        <p className="text-sm text-gray-500">
                          {ds.host}:{ds.port}/{ds.database}
                        </p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-500 -rotate-90" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">暂无可用数据源</p>
                  <button
                    onClick={() => {
                      setShowDatasourceSelect(false)
                      navigate('/datasources/new')
                    }}
                    className="btn-primary"
                  >
                    添加数据源
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}