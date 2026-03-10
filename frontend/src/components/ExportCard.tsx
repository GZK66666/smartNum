import React from 'react';
import { FileDown, Download, FileSpreadsheet, FileText } from 'lucide-react';

interface ExportCardProps {
  filename: string;
  format: string;
  size: number;
  downloadId: string;
  rowCount: number;
  columnCount: number;
}

const ExportCard: React.FC<ExportCardProps> = ({
  filename,
  format,
  size,
  downloadId,
  rowCount,
  columnCount,
}) => {
  // 格式化文件大小
  const formatSize = (kb: number) => {
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  // 获取文件图标
  const getFileIcon = () => {
    if (format === 'xlsx') {
      return <FileSpreadsheet className="w-8 h-8 text-green-400" />;
    }
    return <FileText className="w-8 h-8 text-blue-400" />;
  };

  // 处理下载
  const handleDownload = async () => {
    try {
      // 调用后端下载 API
      const response = await fetch(`http://localhost:8000/api/sessions/export/${downloadId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('下载失败');
      }

      // 获取 blob 并触发下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* 文件图标 */}
          <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-slate-700/50 flex items-center justify-center">
            {getFileIcon()}
          </div>

          {/* 文件信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-base font-medium text-slate-200 truncate">
                {filename}
              </h4>
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded uppercase">
                {format}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>{formatSize(size)}</span>
              <span>{rowCount.toLocaleString()} 行</span>
              <span>{columnCount} 列</span>
            </div>
          </div>

          {/* 下载按钮 */}
          <button
            onClick={handleDownload}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>

        {/* 进度条动画 */}
        <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default ExportCard;
