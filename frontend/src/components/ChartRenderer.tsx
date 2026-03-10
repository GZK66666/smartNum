import React from 'react';
import ReactECharts from 'echarts-for-react';

interface ChartRendererProps {
  chartType: string;
  title: string;
  option: Record<string, unknown>;
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ chartType, title, option }) => {
  // 合并默认配置和用户配置
  const defaultOption: Record<string, unknown> = {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
  };

  const mergedOption = { ...defaultOption, ...option };

  const getChartHeight = () => {
    // 根据图表类型和数据量动态调整高度
    const series = mergedOption.series as Array<Record<string, unknown>> | undefined;
    const dataLength = Array.isArray(series) ? series[0]?.data?.length || 0 : 0;

    if (chartType === 'pie') {
      return 350;
    }

    if (dataLength > 20) {
      return 500;
    }

    return 400;
  };

  return (
    <div className="chart-container my-4 rounded-xl overflow-hidden bg-slate-800/50 border border-slate-700">
      <div className="chart-header px-4 py-3 border-b border-slate-700">
        <h4 className="text-sm font-medium text-slate-200">{title}</h4>
      </div>
      <div className="chart-body p-4">
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
  );
};

export default ChartRenderer;
