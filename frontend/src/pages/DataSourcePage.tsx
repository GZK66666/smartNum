import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '@/store';
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
    isLoadingDataSources,
    fetchDataSources,
    setCurrentDataSource,
    deleteDataSource,
  } = useAppStore();

  useEffect(() => {
    fetchDataSources().catch(() => {
      toast.error('获取数据源列表失败');
    });
  }, [fetchDataSources]);

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
                      onClick={(e) => e.stopPropagation()}
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
                    <span>数据库表</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* This would be populated from schema */}
                    <span className="px-3 py-1 bg-slate-800 rounded-md text-sm text-slate-300">
                      加载中...
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}