import { useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import { Download, Maximize2, Minimize2 } from 'lucide-react';

interface ChartViewerProps {
  option: Record<string, unknown>;
  title?: string;
}

export default function ChartViewer({ option, title }: ChartViewerProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (!chartRef.current || !option) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, 'dark');
    }

    // 应用智能体生成的配置，补充暗色主题
    const finalOption = {
      ...option,
      backgroundColor: 'transparent',
      title: {
        ...(option.title as object),
        textStyle: {
          color: '#e2e8f0',
          fontSize: 14,
          ...((option.title as any)?.textStyle || {}),
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0' },
        ...((option.tooltip as object) || {}),
      },
      legend: {
        bottom: 10,
        textStyle: { color: '#94a3b8' },
        ...((option.legend as object) || {}),
      },
    };

    chartInstance.current.setOption(finalOption);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option]);

  const exportImage = (format: 'png' | 'svg') => {
    if (!chartInstance.current) return;

    const url = chartInstance.current.getDataURL({
      type: format,
      pixelRatio: 2,
      backgroundColor: '#0f172a',
    });

    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'chart'}.${format}`;
    link.click();
    setShowExportMenu(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      chartInstance.current?.resize();
    }, 100);
  };

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-4 z-50 bg-slate-900 rounded-lg' : ''}`}>
      {/* 工具栏 */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* 导出按钮 */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded-lg"
          >
            <Download className="w-4 h-4" />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 flex flex-col bg-slate-800 border border-slate-700 rounded-lg py-1 min-w-[100px]">
                <button
                  onClick={() => exportImage('png')}
                  className="px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 text-left whitespace-nowrap"
                >
                  导出 PNG
                </button>
                <button
                  onClick={() => exportImage('svg')}
                  className="px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 text-left whitespace-nowrap"
                >
                  导出 SVG
                </button>
              </div>
            </>
          )}
        </div>

        {/* 全屏按钮 */}
        <button
          onClick={toggleFullscreen}
          className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded-lg"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 图表容器 */}
      <div
        ref={chartRef}
        className="w-full rounded-lg"
        style={{ height: isFullscreen ? 'calc(100% - 40px)' : '300px' }}
      />
    </div>
  );
}