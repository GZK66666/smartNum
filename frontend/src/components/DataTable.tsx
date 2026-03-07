import { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import type { QueryResult } from '@/types';

interface DataTableProps {
  result: QueryResult;
  pageSize?: number;
}

type SortDirection = 'asc' | 'desc' | null;

export default function DataTable({ result, pageSize = 10 }: DataTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const { columns, rows, total } = result;
  const totalPages = Math.ceil(rows.length / pageSize);

  // Sort data
  const sortedRows = useMemo(() => {
    if (sortColumn === null || sortDirection === null) {
      return rows;
    }

    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, sortColumn, sortDirection]);

  // Paginate data
  const paginatedRows = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(colIndex);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (colIndex: number) => {
    if (sortColumn !== colIndex) {
      return <ChevronsUpDown className="w-3 h-3 text-slate-500" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-3 h-3 text-primary-400" />;
    }
    return <ChevronDown className="w-3 h-3 text-primary-400" />;
  };

  const copyCell = (value: unknown, rowIdx: number, colIdx: number) => {
    const cellKey = `${rowIdx}-${colIdx}`;
    navigator.clipboard.writeText(String(value ?? ''));
    setCopiedCell(cellKey);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        查询结果为空
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="table-container">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 text-left cursor-pointer hover:bg-slate-700/50 transition-colors"
                  onClick={() => handleSort(idx)}
                >
                  <div className="flex items-center gap-2">
                    <span>{col}</span>
                    {getSortIcon(idx)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="table-row group">
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="table-cell relative">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[200px]">
                        {cell === null ? (
                          <span className="text-slate-500 italic">NULL</span>
                        ) : typeof cell === 'number' ? (
                          cell.toLocaleString()
                        ) : (
                          String(cell)
                        )}
                      </span>
                      <button
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
                        onClick={() => copyCell(cell, rowIdx, colIdx)}
                      >
                        {copiedCell === `${rowIdx}-${colIdx}` ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-slate-500">
            显示 {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, total)} 条，共 {total} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="p-1.5 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                  currentPage === i
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="p-1.5 hover:bg-slate-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}