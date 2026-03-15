import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState, useMemo, useEffect } from 'react'
import type { AgentStep } from '../types'

interface AgentStepsProps {
  steps: AgentStep[]
  isStreaming: boolean
}

export default function AgentSteps({ steps, isStreaming }: AgentStepsProps) {
  const [isExpanded, setIsExpanded] = useState(isStreaming)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())

  // 当流式结束时自动收起
  useEffect(() => {
    if (!isStreaming && isExpanded) {
      setIsExpanded(false)
    }
  }, [isStreaming])

  // 获取当前正在执行的步骤
  const currentStep = useMemo(() => {
    return steps.find((step) => step.status === 'running')
  }, [steps])

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  if (steps.length === 0 && !isStreaming) return null

  return (
    <div className="mb-4">
      <div className="glass-card overflow-hidden">
        {/* Header - 可点击展开/折叠 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 border-b border-white/5 flex items-center gap-2 hover:bg-white/5 transition-colors"
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </motion.div>
          {isStreaming ? (
            <>
              <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
              <span className="text-sm font-medium text-accent-primary">智能体执行中</span>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-300">智能体执行步骤</span>
          )}

          {/* 显示当前步骤 */}
          {currentStep && (
            <span className="text-xs text-gray-500 flex items-center gap-1.5 ml-2">
              <span className="text-gray-600">|</span>
              <span className="text-accent-primary">
                {currentStep.name || currentStep.type}
              </span>
            </span>
          )}

          {!isStreaming && steps.length > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {steps.filter((s) => s.status === 'completed').length}/{steps.length} 完成
            </span>
          )}
        </button>

        {/* Steps List - 可折叠 */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="divide-y divide-white/5">
                <AnimatePresence mode="popLayout">
                  {steps.map((step, index) => {
                    const isStepExpanded = expandedSteps.has(step.id)
                    const isRunning = step.status === 'running'
                    const hasDetails = step.details || step.sql

                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="group"
                      >
                        <button
                          onClick={() => hasDetails && toggleStep(step.id)}
                          className={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors ${
                            hasDetails ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          {/* Status Icon */}
                          <div className="flex-shrink-0 mt-0.5">
                            {isRunning ? (
                              <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
                            ) : step.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : step.status === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-500" />
                            )}
                          </div>

                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {/* Type tag */}
                              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-gray-400 font-mono">
                                {step.type}
                              </span>
                              <span className="text-sm font-medium text-gray-200">
                                {step.name || step.type}
                              </span>
                            </div>

                            {/* Preview content */}
                            {step.details && !isStepExpanded && (
                              <p className="text-xs text-gray-500 mt-1 truncate max-w-md font-mono">
                                {step.details.length > 80 ? step.details.substring(0, 80) + '...' : step.details}
                              </p>
                            )}
                          </div>

                          {/* Expand Indicator */}
                          {hasDetails && (
                            <motion.div
                              animate={{ rotate: isStepExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                              className="flex-shrink-0"
                            >
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            </motion.div>
                          )}
                        </button>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isStepExpanded && hasDetails && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 pl-11">
                                <div className="bg-dark-800/50 rounded-lg p-3">
                                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                                    {step.details}
                                  </pre>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}