import ReactECharts from 'echarts-for-react'

interface ChartRendererProps {
  chartType: string
  title: string
  option: Record<string, unknown>
}

export default function ChartRenderer({ chartType, title, option }: ChartRendererProps) {
  const defaultOption: Record<string, unknown> = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
  }

  const mergedOption = { ...defaultOption, ...option }

  const getChartHeight = () => {
    const series = mergedOption.series as Array<Record<string, unknown>> | undefined
    const dataLength = Array.isArray(series) ? (series[0]?.data as unknown[])?.length || 0 : 0

    if (chartType === 'pie') {
      return 350
    }

    if (dataLength > 20) {
      return 500
    }

    return 400
  }

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-dark-800/50 border border-white/5">
      <div className="px-4 py-3 border-b border-white/5">
        <h4 className="text-sm font-medium text-gray-300">{title}</h4>
      </div>
      <div className="p-4">
        <ReactECharts
          option={mergedOption}
          style={{ height: `${getChartHeight()}px` }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
          lazyUpdate={true}
          theme="dark"
        />
      </div>
    </div>
  )
}