import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import {
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Server,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { DatabaseType, DataSourceConfig } from '@/types';

const databaseTypes: { value: DatabaseType; label: string; defaultPort: number }[] = [
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'sqlite', label: 'SQLite', defaultPort: 0 },
];

const defaultConfig: DataSourceConfig = {
  name: '',
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  database: '',
  username: '',
  password: '',
};

export default function NewDataSourcePage() {
  const navigate = useNavigate();
  const { addDataSource, testConnection } = useAppStore();

  const [config, setConfig] = useState<DataSourceConfig>(defaultConfig);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleTypeChange = (type: DatabaseType) => {
    const dbType = databaseTypes.find(t => t.value === type);
    setConfig(prev => ({
      ...prev,
      type,
      port: dbType?.defaultPort || prev.port,
    }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(config);
      setTestResult(result);
      if (result.success) {
        toast.success('连接测试成功');
      } else {
        toast.error(result.message || '连接测试失败');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接测试失败';
      setTestResult({ success: false, message });
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.error('请输入数据源名称');
      return;
    }
    if (!testResult?.success) {
      toast.error('请先测试连接');
      return;
    }

    setIsSaving(true);
    try {
      await addDataSource(config);
      toast.success('数据源添加成功');
      navigate('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : '添加数据源失败';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const isSQLite = config.type === 'sqlite';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">添加数据源</h2>
          <p className="text-slate-400 mt-1">配置新的数据库连接</p>
        </div>
      </div>

      {/* Form */}
      <div className="card space-y-6">
        {/* Database Type Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            数据库类型
          </label>
          <div className="grid grid-cols-3 gap-3">
            {databaseTypes.map((db) => (
              <button
                key={db.value}
                type="button"
                onClick={() => handleTypeChange(db.value)}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  config.type === db.value
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <Database className={`w-6 h-6 mx-auto mb-2 ${
                  config.type === db.value ? 'text-primary-400' : 'text-slate-500'
                }`} />
                <span className={`text-sm font-medium ${
                  config.type === db.value ? 'text-primary-400' : 'text-slate-400'
                }`}>
                  {db.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            数据源名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
            placeholder="例如：生产数据库"
            className="input-field"
          />
        </div>

        {/* Connection Details */}
        {!isSQLite && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                主机地址 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
                placeholder="localhost"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                端口 <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
                placeholder="3306"
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* Database Name / File Path */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            {isSQLite ? '数据库文件路径' : '数据库名称'} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={config.database}
            onChange={(e) => setConfig(prev => ({ ...prev, database: e.target.value }))}
            placeholder={isSQLite ? '/path/to/database.db' : 'my_database'}
            className="input-field"
          />
        </div>

        {/* Credentials (not for SQLite) */}
        {!isSQLite && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                用户名 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                placeholder="root"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                密码 <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={config.password}
                onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-center gap-3 p-4 rounded-lg ${
            testResult.success
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-red-500/10 border border-red-500/20'
          }`}>
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <p className={`font-medium ${
                testResult.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {testResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="btn-secondary flex items-center gap-2"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Server className="w-4 h-4" />
            )}
            测试连接
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !testResult?.success}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            保存数据源
          </button>
        </div>
      </div>
    </div>
  );
}