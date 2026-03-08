import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
import type { TableInfo } from '@/types';
import {
  Database,
  Plus,
  Trash2,
  Server,
  Table2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Columns,
  Key,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const databaseTypes = [
  { value: 'mysql', label: 'MySQL', color: 'text-blue-400' },
  { value: 'postgresql', label: 'PostgreSQL', color: 'text-green-400' },
  { value: 'sqlite', label: 'SQLite', color: 'text-yellow-400' },
] as const;

export default function DataSourcePage() {
  const {
    dataSources,
    currentDataSource,
    schemaInfo,
    isLoadingDataSources,
    fetchDataSources,
    setCurrentDataSource,
    deleteDataSource,
  } = useAppStore();

  // 展开状态
  const [showAllTables, setShowAllTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);

  useEffect(() => {
    fetchDataSources().catch(() => {
      toast.error('获取数据源列表失败');
    });
  }, [fetchDataSources]);

  // 当切换数据源时重置展开状态
  useEffect(() => {
    setShowAllTables(false);
    setSelectedTable(null);
  }, [currentDataSource?.id]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除数据源 "${name}" 吗？`)) return;

    try {
      await deleteDataSource(id);
      toast.success('数据源已删除');
    } catch {
      toast.error('删除数据源失败');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <XCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const displayedTables = schemaInfo?.tables
    ? (showAllTables ? schemaInfo.tables : schemaInfo.tables.slice(0, 10))
    : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">数据源管理</h2>
          <p className="text-slate-400 mt-1">配置和管理您的数据库连接</p>
        </div>
        <Link
          to="/datasource/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加数据源
        </Link>
      </div>

      {/* Data Source List */}
      {isLoadingDataSources ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
        </div>
      ) : dataSources.length === 0 ? (
        <div className="card text-center py-12">
          <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            暂无数据源
          </h3>
          <p className="text-slate-500 mb-6">
            添加您的第一个数据库连接，开始智能问数之旅
          </p>
          <Link to="/datasource/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            添加数据源
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {dataSources.map((ds) => (
            <div
              key={ds.id}
              className={`card group cursor-pointer transition-all duration-200 hover:border-primary-500/50 ${
                currentDataSource?.id === ds.id
                  ? 'border-primary-500/50 ring-1 ring-primary-500/20'
                  : ''
              }`}
              onClick={() => setCurrentDataSource(ds)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Database Icon */}
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Server className="w-6 h-6 text-primary-400" />
                  </div>

                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{ds.name}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 ${
                        databaseTypes.find(t => t.value === ds.type)?.color || 'text-slate-400'
                      }`}>
                        {ds.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {ds.host}:{ds.port}/{ds.database}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Status */}
                  <div className="flex items-center gap-2 text-sm">
                    {getStatusIcon(ds.status)}
                    <span className={`capitalize ${
                      ds.status === 'connected' ? 'text-green-400' :
                      ds.status === 'error' ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {ds.status === 'connected' ? '已连接' : ds.status === 'error' ? '连接错误' : '未连接'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      to="/chat"
                      state={{ datasourceId: ds.id }}
                      className="btn-ghost flex items-center gap-1 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDataSource(ds);
                      }}
                    >
                      开始对话
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <button
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ds.id, ds.name);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tables Preview */}
              {currentDataSource?.id === ds.id && (
                <div className="mt-4 pt-4 border-t border-slate-700/50 animate-fade-in">
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
                    <Table2 className="w-4 h-4" />
                    <span>数据库表 ({schemaInfo?.tables?.length || 0})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {schemaInfo?.tables ? (
                      <>
                        {displayedTables.map((table) => (
                          <button
                            key={table.name}
                            className={`px-3 py-1 rounded-md text-sm transition-colors ${
                              selectedTable?.name === table.name
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                            title={table.comment || table.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTable(selectedTable?.name === table.name ? null : table);
                            }}
                          >
                            {table.name}
                          </button>
                        ))}
                        {schemaInfo.tables.length > 10 && (
                          <button
                            className="px-3 py-1 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllTables(!showAllTables);
                            }}
                          >
                            {showAllTables ? (
                              <span className="flex items-center gap-1">
                                <ChevronUp className="w-4 h-4" />
                                收起
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <ChevronDown className="w-4 h-4" />
                                +{schemaInfo.tables.length - 10} 更多...
                              </span>
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="px-3 py-1 bg-slate-800 rounded-md text-sm text-slate-400">
                        <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
                        加载中...
                      </span>
                    )}
                  </div>

                  {/* Table Details */}
                  {selectedTable && (
                    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 animate-fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-slate-200 flex items-center gap-2">
                          <Columns className="w-4 h-4" />
                          {selectedTable.name}
                          {selectedTable.comment && (
                            <span className="text-sm text-slate-400 font-normal">
                              - {selectedTable.comment}
                            </span>
                          )}
                        </h4>
                        <button
                          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTable(null);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">列名</th>
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">类型</th>
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">可空</th>
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">键</th>
                              <th className="text-left py-2 px-3 text-slate-400 font-medium">说明</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTable.columns.map((col) => (
                              <tr key={col.name} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                <td className="py-2 px-3 text-slate-200 flex items-center gap-2">
                                  {col.key === 'PRI' && <Key className="w-3 h-3 text-yellow-400" />}
                                  {col.name}
                                </td>
                                <td className="py-2 px-3 text-slate-400 font-mono text-xs">{col.type}</td>
                                <td className="py-2 px-3">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    col.nullable ? 'bg-slate-700 text-slate-400' : 'bg-red-900/50 text-red-400'
                                  }`}>
                                    {col.nullable ? '是' : '否'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-400">{col.key || '-'}</td>
                                <td className="py-2 px-3 text-slate-500">{col.comment || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}