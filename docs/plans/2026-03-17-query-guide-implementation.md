# 查询指南模块实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增查询指南模块，支持用户为数据源上传文档或编写备注，智能体在查询前可自由探索。

**Architecture:** 文件系统存储文档，侧边抽屉编辑界面，新增智能体工具 `explore_query_guide`。

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript

---

## Task 1: 数据库迁移 - 新增字段

**Files:**
- Modify: `app/models/models.py`
- Modify: `init_db.sql`

**Step 1: 修改数据模型**

在 `app/models/models.py` 的 `DataSource` 类中添加字段：

```python
# 在 tables_info 字段后添加
query_guide_updated_at = Column(DateTime, comment="查询指南最后更新时间")
```

**Step 2: 更新 init_db.sql**

在 `datasources` 表定义中添加字段：

```sql
query_guide_updated_at DATETIME COMMENT '查询指南最后更新时间',
```

**Step 3: 提交**

```bash
git add app/models/models.py init_db.sql
git commit -m "feat: 数据源表增加 query_guide_updated_at 字段"
```

---

## Task 2: 后端服务 - 查询指南服务

**Files:**
- Create: `app/services/query_guide_service.py`

**Step 1: 创建服务类**

```python
"""查询指南服务 - 文档存储与探索"""

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession

# 查询指南根目录
QUERY_GUIDE_BASE_DIR = Path("data/query_guides")
ALLOWED_EXTENSIONS = {".txt", ".md", ".docx", ".pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class QueryGuideService:
    """查询指南服务类"""

    def __init__(self, db: AsyncSession = None):
        self.db = db

    def _get_guide_dir(self, datasource_id: str) -> Path:
        """获取查询指南目录"""
        return QUERY_GUIDE_BASE_DIR / datasource_id

    def _get_uploaded_dir(self, datasource_id: str) -> Path:
        """获取上传文档目录"""
        return self._get_guide_dir(datasource_id) / "uploaded"

    def _get_notes_path(self, datasource_id: str) -> Path:
        """获取备注文件路径"""
        return self._get_guide_dir(datasource_id) / "notes.md"

    def _ensure_dir(self, path: Path):
        """确保目录存在"""
        path.mkdir(parents=True, exist_ok=True)

    async def get_guide_content(self, datasource_id: str) -> dict:
        """获取查询指南内容"""
        uploaded_dir = self._get_uploaded_dir(datasource_id)
        notes_path = self._get_notes_path(datasource_id)

        # 获取已上传文件列表
        files = []
        if uploaded_dir.exists():
            for f in uploaded_dir.iterdir():
                if not f.name.startswith('.'):
                    files.append({
                        "filename": f.name,
                        "size": f.stat().st_size,
                        "updated_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                    })

        # 获取备注内容
        notes = ""
        if notes_path.exists():
            notes = notes_path.read_text(encoding="utf-8")

        return {
            "files": sorted(files, key=lambda x: x["filename"]),
            "notes": notes,
        }

    async def update_notes(self, datasource_id: str, notes: str):
        """更新备注内容"""
        guide_dir = self._get_guide_dir(datasource_id)
        self._ensure_dir(guide_dir)

        notes_path = self._get_notes_path(datasource_id)
        notes_path.write_text(notes, encoding="utf-8")

    async def upload_file(
        self,
        datasource_id: str,
        filename: str,
        content: bytes,
    ) -> dict:
        """上传文档"""
        file_ext = Path(filename).suffix.lower()

        if file_ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {file_ext}")

        if len(content) > MAX_FILE_SIZE:
            raise ValueError(f"文件大小超过限制（最大 {MAX_FILE_SIZE // 1024 // 1024}MB）")

        uploaded_dir = self._get_uploaded_dir(datasource_id)
        self._ensure_dir(uploaded_dir)

        # 处理重名文件
        raw_filename = filename
        counter = 1
        while (uploaded_dir / raw_filename).exists():
            stem = Path(filename).stem
            raw_filename = f"{stem}_{counter}{file_ext}"
            counter += 1

        file_path = uploaded_dir / raw_filename
        file_path.write_bytes(content)

        return {
            "filename": raw_filename,
            "size": len(content),
        }

    async def delete_file(self, datasource_id: str, filename: str) -> bool:
        """删除文档"""
        uploaded_dir = self._get_uploaded_dir(datasource_id)
        file_path = uploaded_dir / filename

        if file_path.exists() and file_path.is_file():
            file_path.unlink()
            return True
        return False

    def explore_guide(self, datasource_id: str, command: str) -> str:
        """探索查询指南（执行 shell 命令）"""
        guide_dir = self._get_guide_dir(datasource_id)

        if not guide_dir.exists():
            return "查询指南为空，请先上传文档或添加备注"

        # 允许的命令
        allowed_commands = ["grep", "find", "cat", "ls", "head", "tail", "wc"]

        cmd_parts = command.split()
        if not cmd_parts or cmd_parts[0] not in allowed_commands:
            return f"错误：只允许使用以下命令：{', '.join(allowed_commands)}"

        import subprocess
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(guide_dir),
                capture_output=True,
                text=True,
                timeout=10,
            )

            output = result.stdout or result.stderr

            if len(output) > 10000:
                output = output[:10000] + "\n\n... [输出已截断]"

            return output or "(无输出)"

        except subprocess.TimeoutExpired:
            return "错误：命令执行超时"
        except Exception as e:
            return f"错误：{str(e)}"

    def list_guide_structure(self, datasource_id: str) -> str:
        """列出查询指南结构"""
        guide_dir = self._get_guide_dir(datasource_id)

        if not guide_dir.exists():
            return "查询指南为空"

        lines = ["# 查询指南文件列表\n"]

        # 列出备注
        notes_path = self._get_notes_path(datasource_id)
        if notes_path.exists():
            lines.append("## 📝 备注说明\n")
            lines.append("- `notes.md` (手动编辑)\n")

        # 列出上传的文档
        uploaded_dir = self._get_uploaded_dir(datasource_id)
        if uploaded_dir.exists():
            files = [f for f in uploaded_dir.iterdir() if not f.name.startswith('.')]
            if files:
                lines.append("\n## 📄 上传文档\n")
                for f in sorted(files):
                    lines.append(f"- `{f.name}`")

        return "\n".join(lines)

    async def cleanup_guide_files(self, datasource_id: str):
        """清理数据源的查询指南文件"""
        import shutil
        guide_dir = self._get_guide_dir(datasource_id)
        if guide_dir.exists():
            shutil.rmtree(guide_dir)
```

**Step 2: 提交**

```bash
git add app/services/query_guide_service.py
git commit -m "feat: 新增查询指南服务"
```

---

## Task 3: 后端路由 - 查询指南 API

**Files:**
- Modify: `app/routers/datasources.py`

**Step 1: 添加查询指南相关 API**

在 `app/routers/datasources.py` 末尾添加：

```python
# ==================== 查询指南 API ====================

@router.get("/{datasource_id}/query-guide", response_model=dict)
async def get_query_guide(
    datasource_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """获取数据源的查询指南"""
    from app.services.query_guide_service import QueryGuideService

    # 验证数据源归属
    ds_service = DataSourceService(db, user_id)
    datasource = await ds_service.get_datasource(datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.DATASOURCE_NOT_FOUND, "message": "数据源不存在"},
        )

    guide_service = QueryGuideService(db)
    content = await guide_service.get_guide_content(datasource_id)

    return {"code": 0, "data": content}


@router.put("/{datasource_id}/query-guide", response_model=dict)
async def update_query_guide(
    datasource_id: str,
    notes: str = Form(default=""),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """更新查询指南备注"""
    from app.services.query_guide_service import QueryGuideService

    # 验证数据源归属
    ds_service = DataSourceService(db, user_id)
    datasource = await ds_service.get_datasource(datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.DATASOURCE_NOT_FOUND, "message": "数据源不存在"},
        )

    guide_service = QueryGuideService(db)
    await guide_service.update_notes(datasource_id, notes)

    # 更新数据源的 query_guide_updated_at
    datasource.query_guide_updated_at = datetime.utcnow()
    await db.commit()

    return {"code": 0, "message": "查询指南已更新"}


@router.post("/{datasource_id}/query-guide/upload", response_model=dict)
async def upload_query_guide_file(
    datasource_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """上传查询指南文档"""
    from app.services.query_guide_service import QueryGuideService

    # 验证数据源归属
    ds_service = DataSourceService(db, user_id)
    datasource = await ds_service.get_datasource(datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.DATASOURCE_NOT_FOUND, "message": "数据源不存在"},
        )

    guide_service = QueryGuideService(db)

    content = await file.read()

    try:
        result = await guide_service.upload_file(
            datasource_id=datasource_id,
            filename=file.filename or "unknown",
            content=content,
        )

        # 更新数据源的 query_guide_updated_at
        datasource.query_guide_updated_at = datetime.utcnow()
        await db.commit()

        return {"code": 0, "data": result}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.INVALID_REQUEST, "message": str(e)},
        )


@router.delete("/{datasource_id}/query-guide/files/{filename}", response_model=dict)
async def delete_query_guide_file(
    datasource_id: str,
    filename: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """删除查询指南文档"""
    from app.services.query_guide_service import QueryGuideService

    # 验证数据源归属
    ds_service = DataSourceService(db, user_id)
    datasource = await ds_service.get_datasource(datasource_id)
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.DATASOURCE_NOT_FOUND, "message": "数据源不存在"},
        )

    guide_service = QueryGuideService(db)
    success = await guide_service.delete_file(datasource_id, filename)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.DATASOURCE_NOT_FOUND, "message": "文件不存在"},
        )

    return {"code": 0, "message": "文件已删除"}
```

**Step 2: 添加必要的导入**

在文件顶部添加：
```python
from datetime import datetime
```

**Step 3: 提交**

```bash
git add app/routers/datasources.py
git commit -m "feat: 新增查询指南 API 接口"
```

---

## Task 4: 智能体工具 - explore_query_guide

**Files:**
- Modify: `app/services/agent_service.py`

**Step 1: 删除知识库相关 System Prompt**

找到 `SYSTEM_PROMPT` 中关于知识库的描述并删除。

**Step 2: 添加查询指南 System Prompt**

在 `SYSTEM_PROMPT` 中添加：

```markdown
## 查询指南

每个数据源可能有查询指南文档，包含表说明、业务规则、SQL参考等。
在查询数据前，建议先查阅查询指南：`explore_query_guide("ls -la")`
不确定业务逻辑时，务必查阅查询指南。
```

**Step 3: 新增 explore_query_guide 工具**

在 `# ==================== 知识库工具 ====================` 注释前添加：

```python
# ==================== 查询指南工具 ====================

@tool
async def explore_query_guide(command: str) -> str:
    """浏览查询指南文档。

    查询指南包含该数据源的业务规则、数据字典、SQL参考等。
    在查询数据前，建议先查阅查询指南。

    常用命令:
    - ls -la : 查看有哪些文档
    - cat *.md : 阅读所有文档
    - grep "关键词" *.md : 搜索特定内容

    Args:
        command: 要执行的 shell 命令 (支持: ls, cat, grep, head, tail, wc, find)

    Returns:
        命令执行结果

    Examples:
        explore_query_guide("ls -la")  # 列出所有文档
        explore_query_guide("cat *.md")  # 阅读全部内容
        explore_query_guide("grep -i '用户' *.md")  # 搜索用户相关内容
    """
    from app.services.query_guide_service import QueryGuideService
    from app.models.database import async_session_maker

    ctx = get_db_context()
    if ctx is None:
        return "错误: 未找到数据库连接上下文"

    datasource_id = ctx.get("datasource_id")
    if not datasource_id:
        return "错误: 未找到数据源ID"

    service = QueryGuideService()
    output = service.explore_guide(
        datasource_id=datasource_id,
        command=command,
    )
    return output
```

**Step 4: 注册工具到 Agent**

在 `get_agent()` 函数的 `tools` 列表中添加 `explore_query_guide`：

```python
tools=[
    list_tables, get_table_schema, run_sql, render_chart, export_data,
    explore_query_guide,
],
```

**Step 5: 删除 explore_knowledge 工具注册**

从 `tools` 列表中移除 `explore_knowledge`。

**Step 6: 提交**

```bash
git add app/services/agent_service.py
git commit -m "feat: 新增 explore_query_guide 工具，移除知识库感知"
```

---

## Task 5: 前端 API - 查询指南接口

**Files:**
- Modify: `frontend/src/services/api.ts`

**Step 1: 添加查询指南 API 方法**

在 `datasourceApi` 对象中添加：

```typescript
// 查询指南相关
getQueryGuide: async (datasourceId: string): Promise<{
  files: Array<{
    filename: string
    size: number
    updated_at: string
  }>
  notes: string
}> => {
  const token = localStorage.getItem('token')
  const response = await fetch(`${API_BASE}/api/datasources/${datasourceId}/query-guide`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.detail?.code || response.status,
      data.detail?.message || '获取查询指南失败',
      response.status
    )
  }

  return data.data
},

updateQueryGuideNotes: async (datasourceId: string, notes: string): Promise<void> => {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('notes', notes)

  const response = await fetch(`${API_BASE}/api/datasources/${datasourceId}/query-guide`, {
    method: 'PUT',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.detail?.code || response.status,
      data.detail?.message || '更新查询指南失败',
      response.status
    )
  }
},

uploadQueryGuideFile: async (datasourceId: string, file: File): Promise<{
  filename: string
  size: number
}> => {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/datasources/${datasourceId}/query-guide/upload`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.detail?.code || response.status,
      data.detail?.message || '上传文件失败',
      response.status
    )
  }

  return data.data
},

deleteQueryGuideFile: async (datasourceId: string, filename: string): Promise<void> => {
  const token = localStorage.getItem('token')
  const response = await fetch(
    `${API_BASE}/api/datasources/${datasourceId}/query-guide/files/${encodeURIComponent(filename)}`,
    {
      method: 'DELETE',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    }
  )

  const data = await response.json()

  if (!response.ok) {
    throw new ApiError(
      data.detail?.code || response.status,
      data.detail?.message || '删除文件失败',
      response.status
    )
  }
},
```

**Step 2: 提交**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: 前端新增查询指南 API 方法"
```

---

## Task 6: 前端组件 - 编辑数据源抽屉

**Files:**
- Create: `frontend/src/components/EditDataSourceDrawer.tsx`

**Step 1: 创建侧边抽屉组件**

```tsx
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Upload,
  FileText,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import { datasourceApi } from '../services/api'

interface Props {
  isOpen: boolean
  onClose: () => void
  datasource: {
    id: string
    name: string
    type: string
    host?: string
    port?: number
    database_name?: string
    db_username?: string
    schema_name?: string
  } | null
  onUpdate?: () => void
}

export default function EditDataSourceDrawer({ isOpen, onClose, datasource, onUpdate }: Props) {
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<Array<{
    filename: string
    size: number
    updated_at: string
  }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载查询指南内容
  useEffect(() => {
    if (isOpen && datasource) {
      loadQueryGuide()
    }
  }, [isOpen, datasource])

  const loadQueryGuide = async () => {
    if (!datasource) return

    setIsLoading(true)
    try {
      const data = await datasourceApi.getQueryGuide(datasource.id)
      setNotes(data.notes)
      setFiles(data.files)
    } catch (err) {
      console.error('加载查询指南失败:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!datasource) return

    setIsSaving(true)
    try {
      await datasourceApi.updateQueryGuideNotes(datasource.id, notes)
      onUpdate?.()
      onClose()
    } catch (err) {
      console.error('保存失败:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !datasource) return

    try {
      const result = await datasourceApi.uploadQueryGuideFile(datasource.id, file)
      setFiles(prev => [...prev, {
        filename: result.filename,
        size: result.size,
        updated_at: new Date().toISOString(),
      }])
    } catch (err) {
      console.error('上传失败:', err)
    }

    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteFile = async (filename: string) => {
    if (!datasource) return

    try {
      await datasourceApi.deleteQueryGuideFile(datasource.id, filename)
      setFiles(prev => prev.filter(f => f.filename !== filename))
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  if (!datasource) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* 侧边抽屉 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-dark-800 border-l border-white/10 z-50 overflow-y-auto"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">编辑数据源</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 基本信息 */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-gray-300 mb-3">基本信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">名称</span>
                  <span className="text-white">{datasource.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">类型</span>
                  <span className="text-white">{datasource.type.toUpperCase()}</span>
                </div>
                {datasource.host && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">主机</span>
                    <span className="text-white">{datasource.host}:{datasource.port}</span>
                  </div>
                )}
                {datasource.database_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">数据库</span>
                    <span className="text-white">{datasource.database_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 查询指南 */}
            <div className="p-4">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-300 mb-3"
              >
                <span>查询指南</span>
                {showGuide ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showGuide && (
                <div className="space-y-4">
                  {/* 提示 */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium mb-1">查询指南帮助智能体更准确理解数据</p>
                        <p className="text-blue-200/70">
                          内容越规范、越详细，查询效果越好。建议包含：表/字段说明、常用SQL参考、业务规则、注意事项等。
                        </p>
                        <p className="text-yellow-300/80 mt-1">⚠️ 文档越多，查询响应可能稍慢</p>
                      </div>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <>
                      {/* 已上传文档 */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-400">📄 已上传文档</span>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-accent-primary hover:text-accent-secondary"
                          >
                            + 上传文档
                          </button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.md,.docx,.pdf"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>

                        {files.length > 0 ? (
                          <div className="space-y-1">
                            {files.map(file => (
                              <div
                                key={file.filename}
                                className="flex items-center justify-between bg-dark-700 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <span className="text-sm text-white truncate">{file.filename}</span>
                                  <span className="text-xs text-gray-500">
                                    {(file.size / 1024).toFixed(1)}KB
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteFile(file.filename)}
                                  className="text-gray-400 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 text-center py-2">暂无上传文档</p>
                        )}
                      </div>

                      {/* 备注说明 */}
                      <div>
                        <span className="text-sm text-gray-400 mb-2 block">📝 备注说明</span>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="# 表说明&#10;&#10;## users 表&#10;用户基础信息表...&#10;&#10;## 常用查询参考&#10;- 查询活跃用户: SELECT * FROM users WHERE status = 1"
                          className="w-full h-64 bg-dark-700 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-accent-primary"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-dark-800 border-t border-white/10">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

**Step 2: 提交**

```bash
git add frontend/src/components/EditDataSourceDrawer.tsx
git commit -m "feat: 新增编辑数据源侧边抽屉组件"
```

---

## Task 7: 前端集成 - 数据源列表页

**Files:**
- Modify: `frontend/src/pages/DataSourcesPage.tsx`

**Step 1: 导入组件**

```tsx
import { useState } from 'react'
import EditDataSourceDrawer from '../components/EditDataSourceDrawer'
```

**Step 2: 添加状态**

```tsx
const [editingDatasource, setEditingDatasource] = useState<{
  id: string
  name: string
  type: string
  host?: string
  port?: number
  database_name?: string
  db_username?: string
  schema_name?: string
} | null>(null)
```

**Step 3: 在数据源卡片中添加编辑按钮**

在每个数据源卡片中，添加编辑按钮：

```tsx
<button
  onClick={() => setEditingDatasource(ds)}
  className="text-gray-400 hover:text-white text-sm"
>
  编辑
</button>
```

**Step 4: 添加抽屉组件**

在组件末尾添加：

```tsx
<EditDataSourceDrawer
  isOpen={!!editingDatasource}
  onClose={() => setEditingDatasource(null)}
  datasource={editingDatasource}
  onUpdate={() => queryClient.invalidateQueries({ queryKey: ['datasources'] })}
/>
```

**Step 5: 提交**

```bash
git add frontend/src/pages/DataSourcesPage.tsx
git commit -m "feat: 数据源列表集成编辑抽屉"
```

---

## Task 8: 更新文档

**Files:**
- Modify: `docs/更新日志.md`
- Modify: `README.md`

**Step 1: 更新更新日志**

在 `docs/更新日志.md` 顶部添加：

```markdown
## [3.4] - 2026-03-17

### 新增

- **查询指南模块**
  - 为每个数据源绑定独立的查询指南
  - 支持上传文档（txt/md/docx/pdf）和手动备注
  - 智能体查询前可自由探索查询指南
  - 侧边抽屉编辑界面

### 变更

- 知识库模块不再在智能体中主动提及（保持代码，无感知）
```

**Step 2: 更新 README**

在功能特性部分添加查询指南说明。

**Step 3: 提交**

```bash
git add docs/更新日志.md README.md
git commit -m "docs: 更新文档 - 查询指南模块"
```

---

## Task 9: 最终提交

**Step 1: 检查所有更改**

```bash
git status
```

**Step 2: 推送到远程**

```bash
git push origin master
```

---

## 注意事项

1. **数据库迁移**：用户需要重新执行 `init_db.sql` 或手动添加 `query_guide_updated_at` 字段
2. **目录创建**：后端服务启动时会自动创建 `data/query_guides/` 目录
3. **知识库兼容**：现有知识库代码和文件保持不变，仅智能体不再主动使用