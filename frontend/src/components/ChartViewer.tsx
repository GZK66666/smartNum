import { useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import {
  BarChart2,
  LineChart,
  PieChart,
  ScatterChart,
  Download,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { QueryResult, ChartSuggestion, ChartType } from '@/types';

interface ChartViewerProps {
  data: QueryResult;
  suggestion: ChartSuggestion;
  onChartTypeChange?: (type: ChartType) => void;
}

const chartTypeIcons: Record<ChartType, React.ReactNode> = {
  bar: <BarChart2 className="w-4 h-4" />,
  line: <LineChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
  scatter: <ScatterChart className="w-4 h-4" />,
  histogram: <BarChart2 className="w-4 h-4" />,
  area: <LineChart className="w-4 h-4" />,
};

const availableChartTypes: ChartType[] = ['bar', 'line', 'pie', 'scatter'];

export default function ChartViewer({
  data,
  suggestion,
  onChartTypeChange,
}: ChartViewerProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [currentType, setCurrentType] = useState<ChartType>(suggestion.chart_type);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 获取数据字段索引
  const getFieldIndex = (field: string) => {
    return data.columns.indexOf(field);
  };

  // 准备图表数据
  const prepareChartData = () => {
    const { rows } = data;
    const xField = suggestion.x_axis.field;
    const yField = suggestion.y_axis.field;
    const xIdx = getFieldIndex(xField);
    const yIdx = getFieldIndex(yField);

    if (xIdx === -1 || yIdx === -1) return null;

    return rows.map((row) => ({
      name: String(row[xIdx] ?? ''),
      value: typeof row[yIdx] === 'number' ? row[yIdx] : 0,
    }));
  };

  // 生成 ECharts 配置
  const getChartOption = () => {
    const chartData = prepareChartData();
    if (!chartData) return {};

    const baseOption = {
      title: {
        text: suggestion.title,
        left: 'center' as const,
        textStyle: {
          color: '#e2e8f0',
          fontSize: 14,
        },
      },
      tooltip: {
        trigger: currentType === 'pie' ? 'item' as const : 'axis' as const,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: '#334155',
        textStyle: {
          color: '#e2e8f0',
        },
      },
      legend: {
        show: suggestion.options?.show_legend ?? true,
        bottom: 10,
        textStyle: {
          color: '#94a3b8',
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: suggestion.options?.show_legend !== false ? '15%' : '10%',
        top: '15%',
        containLabel: true,
      },
    };

    // 系列配置
    switch (currentType) {
      case 'bar':
        return {
          ...baseOption,
          xAxis: {
            type: 'category' as const,
            data: chartData.map((d) => d.name),
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: {
              color: '#94a3b8',
              rotate: chartData.length > 8 ? 45 : 0,
            },
          },
          yAxis: {
            type: 'value' as const,
            name: suggestion.y_axis.label,
            nameTextStyle: { color: '#94a3b8' },
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: '#1e293b' } },
          },
          series: [
            {
              type: 'bar' as const,
              data: chartData.map((d) => d.value),
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#3b82f6' },
                  { offset: 1, color: '#1d4ed8' },
                ]),
                borderRadius: [4, 4, 0, 0],
              },
              emphasis: {
                itemStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#60a5fa' },
                    { offset: 1, color: '#3b82f6' },
                  ]),
                },
              },
              label: suggestion.options?.show_data_labels
                ? { show: true, position: 'top' as const, color: '#94a3b8' }
                : undefined,
            },
          ],
        };

      case 'line':
        return {
          ...baseOption,
          xAxis: {
            type: 'category' as const,
            data: chartData.map((d) => d.name),
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: {
              color: '#94a3b8',
              rotate: chartData.length > 8 ? 45 : 0,
            },
          },
          yAxis: {
            type: 'value' as const,
            name: suggestion.y_axis.label,
            nameTextStyle: { color: '#94a3b8' },
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: '#1e293b' } },
          },
          series: [
            {
              type: 'line' as const,
              data: chartData.map((d) => d.value),
              smooth: true,
              symbol: 'circle',
              symbolSize: 8,
              lineStyle: { color: '#3b82f6', width: 2 },
              itemStyle: { color: '#3b82f6' },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
                ]),
              },
              label: suggestion.options?.show_data_labels
                ? { show: true, position: 'top' as const, color: '#94a3b8' }
                : undefined,
            },
          ],
        };

      case 'pie':
        return {
          ...baseOption,
          series: [
            {
              type: 'pie' as const,
              data: chartData,
              radius: ['40%', '70%'],
              center: ['50%', '45%'],
              avoidLabelOverlap: true,
              itemStyle: {
                borderRadius: 8,
                borderColor: '#0f172a',
                borderWidth: 2,
              },
              label: {
                show: suggestion.options?.show_data_labels ?? true,
                color: '#94a3b8',
              },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 14,
                  fontWeight: 'bold' as const,
                },
              },
              labelLine: {
                lineStyle: { color: '#475569' },
              },
            },
          ],
          color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
        };

      case 'scatter':
        return {
          ...baseOption,
          xAxis: {
            type: 'category' as const,
            data: chartData.map((d) => d.name),
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#94a3b8' },
          },
          yAxis: {
            type: 'value' as const,
            name: suggestion.y_axis.label,
            nameTextStyle: { color: '#94a3b8' },
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: '#1e293b' } },
          },
          series: [
            {
              type: 'scatter' as const,
              data: chartData.map((d) => [d.name, d.value]),
              symbolSize: 10,
              itemStyle: {
                color: '#3b82f6',
              },
              emphasis: {
                itemStyle: {
                  color: '#60a5fa',
                },
              },
            },
          ],
        };

      default:
        return baseOption;
    }
  };

  // 初始化图表
  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    chartInstance.current.setOption(getChartOption());

    // 响应式
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [currentType, data, suggestion]);

  // 更新图表配置
  useEffect(() => {
    chartInstance.current?.setOption(getChartOption(), true);
  }, [currentType]);

  // 切换图表类型
  const handleChartTypeChange = (type: ChartType) => {
    setCurrentType(type);
    onChartTypeChange?.(type);
  };

  // 导出图片
  const exportImage = (format: 'png' | 'svg') => {
    if (!chartInstance.current) return;

    const url = chartInstance.current.getDataURL({
      type: format,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
    });

    const link = document.createElement('a');
    link.href = url;
    link.download = `${suggestion.title || 'chart'}.${format}`;
    link.click();
  };

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      chartInstance.current?.resize();
    }, 100);
  };

  return (
    <div
      className={`relative ${isFullscreen ? 'fixed inset-4 z-50 bg-slate-900 rounded-lg' : ''}`}
    >
      {/* 工具栏 */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* 图表类型切换 */}
        <div className="flex items-center bg-slate-800/80 rounded-lg p-1">
          {availableChartTypes.map((type) => (
            <button
              key={type}
              onClick={() => handleChartTypeChange(type)}
              className={`p-1.5 rounded transition-colors ${
                currentType === type
                  ? 'bg-primary-500/20 text-primary-400'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700'
              }`}
              title={type.charAt(0).toUpperCase() + type.slice(1)}
            >
              {chartTypeIcons[type]}
            </button>
          ))}
        </div>

        {/* 导出按钮 */}
        <div className="relative group">
          <button className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded-lg">
            <Download className="w-4 h-4" />
          </button>
          <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-slate-800 border border-slate-700 rounded-lg py-1 min-w-[100px]">
            <button
              onClick={() => exportImage('png')}
              className="px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 text-left"
            >
              导出 PNG
            </button>
            <button
              onClick={() => exportImage('svg')}
              className="px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 text-left"
            >
              导出 SVG
            </button>
          </div>
        </div>

        {/* 全屏按钮 */}
        <button
          onClick={toggleFullscreen}
          className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded-lg"
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 图表容器 */}
      <div
        ref={chartRef}
        className="w-full rounded-lg"
        style={{ height: isFullscreen ? 'calc(100% - 40px)' : '300px' }}
      />

      {/* 置信度提示 */}
      {suggestion.confidence < 0.8 && (
        <div className="absolute bottom-2 left-2 text-xs text-slate-500">
          图表推荐置信度: {Math.round(suggestion.confidence * 100)}%
        </div>
      )}
    </div>
  );
}