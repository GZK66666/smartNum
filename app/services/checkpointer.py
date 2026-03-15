"""Checkpointer 配置模块

提供 LangGraph 的状态持久化配置：
- 开发环境：MemorySaver（内存存储，重启丢失）
- 生产环境：AsyncSqliteSaver（SQLite 文件存储）

注意：LangGraph 官方暂不支持 MySQL checkpointer。
"""

import os
from typing import Optional

from app.core import get_settings

settings = get_settings()

# 全局 checkpointer 实例（延迟初始化）
_checkpointer = None
_store = None


async def get_checkpointer():
    """获取 checkpointer 实例

    Returns:
        MemorySaver 或 AsyncSqliteSaver 实例
    """
    global _checkpointer
    if _checkpointer is not None:
        return _checkpointer

    # 根据环境选择 checkpointer
    if settings.debug:
        # 开发环境：内存存储
        from langgraph.checkpoint.memory import MemorySaver
        _checkpointer = MemorySaver()
        print("[Checkpointer] 使用 MemorySaver（开发模式）")
    else:
        # 生产环境：SQLite 文件存储
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

        # checkpoint 数据存储在数据目录
        checkpoint_dir = os.path.join(os.getcwd(), "data")
        os.makedirs(checkpoint_dir, exist_ok=True)
        checkpoint_path = os.path.join(checkpoint_dir, "checkpoints.db")

        _checkpointer = AsyncSqliteSaver.from_conn_string(checkpoint_path)
        print(f"[Checkpointer] 使用 AsyncSqliteSaver: {checkpoint_path}")

    return _checkpointer


def get_store():
    """获取跨会话记忆存储

    用于存储用户偏好、长期记忆等跨会话数据。

    Returns:
        InMemoryStore 实例
    """
    global _store
    if _store is None:
        from langgraph.store.memory import InMemoryStore
        _store = InMemoryStore()
        print("[Store] 使用 InMemoryStore")

    return _store


async def init_checkpointer():
    """初始化 checkpointer（应用启动时调用）

    用于预创建 SQLite 表结构等初始化工作。
    """
    checkpointer = await get_checkpointer()

    # SQLite checkpointer 需要创建表
    if hasattr(checkpointer, 'setup'):
        try:
            await checkpointer.setup()
            print("[Checkpointer] 初始化完成")
        except Exception as e:
            print(f"[Checkpointer] 初始化失败: {e}")
            raise


async def close_checkpointer():
    """关闭 checkpointer（应用关闭时调用）

    清理资源，确保数据写入磁盘。
    """
    global _checkpointer

    if _checkpointer is not None:
        # AsyncSqliteSaver 需要关闭连接
        if hasattr(_checkpointer, 'conn'):
            try:
                await _checkpointer.conn.close()
                print("[Checkpointer] 连接已关闭")
            except Exception as e:
                print(f"[Checkpointer] 关闭连接失败: {e}")

        _checkpointer = None