import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { QueryResult } from '@/types';

interface ExportButtonProps {
  data: QueryResult;
  filename?: string;
  formats?: ('csv' | 'excel')[];
}

export default function ExportButton({
  data,
  filename = 'query_result',
  formats = ['csv', 'excel'],
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // 准备数据
  const prepareData = () => {
    const { columns, rows } = data;
    return rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  };

  // 导出 CSV
  const exportCSV = () => {
    setIsExporting(true);
    try {
      const jsonData = prepareData();
      const csv = Papa.unparse(jsonData);

      // 添加 BOM 以支持中文
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();

      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  // 导出 Excel
  const exportExcel = () => {
    setIsExporting(true);
    try {
      const jsonData = prepareData();

      // 创建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(jsonData);

      // 设置列宽
      const colWidths = data.columns.map((col, idx) => {
        let maxWidth = col.length;
        data.rows.forEach((row) => {
          const cellValue = String(row[idx] ?? '');
          maxWidth = Math.max(maxWidth, cellValue.length);
        });
        return { wch: Math.min(maxWidth + 2, 50) };
      });
      ws['!cols'] = colWidths;

      // 冻结首行
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      // 添加自动筛选
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

      XLSX.utils.book_append_sheet(wb, ws, 'Query Result');

      // 导出
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally {
      setIsExporting(false);
      setShowMenu(false);
    }
  };

  // 检查数据量
  const isLargeData = data.rows.length > 10000;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className="btn-ghost text-sm flex items-center gap-2"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        导出
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
            {isLargeData && (
              <div className="px-3 py-2 text-xs text-yellow-400 border-b border-slate-700">
                数据量较大 ({data.rows.length.toLocaleString()} 条)
              </div>
            )}

            {formats.includes('csv') && (
              <button
                onClick={exportCSV}
                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-green-400" />
                导出 CSV
              </button>
            )}

            {formats.includes('excel') && (
              <button
                onClick={exportExcel}
                className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                导出 Excel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}