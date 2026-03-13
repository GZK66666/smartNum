"""会话服务 - V3.0 持久化版本"""

import json
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from sqlalchemy.orm import selectinload

from app.models.models import Session, Message, DataSource
from app.services.agent_service import process_query_stream


class SessionService:
    """会话服务类"""

    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id
        self._owns_db = False  # 标记是否拥有数据库会话

    @classmethod
    async def create_for_stream(cls, user_id: str) -> "SessionService":
        """为流式处理创建独立的 SessionService 实例（使用独立数据库会话）"""
        from app.models.database import async_session_maker
        db = async_session_maker()
        instance = cls(db, user_id)
        instance._owns_db = True
        return instance

    async def close(self):
        """关闭数据库会话（如果由本实例创建）"""
        if self._owns_db and self.db:
            await self.db.commit()
            await self.db.close()

    async def create_session(self, datasource_id: str) -> Session:
        """创建会话"""
        # 验证数据源存在且属于当前用户
        result = await self.db.execute(
            select(DataSource).where(
                DataSource.id == datasource_id,
                DataSource.user_id == self.user_id,
            )
        )
        ds = result.scalar_one_or_none()

        if ds is None:
            raise ValueError(f"数据源不存在：{datasource_id}")

        # 创建会话
        session = Session(
            id=str(uuid.uuid4()),
            user_id=self.user_id,
            datasource_id=datasource_id,
            title="新对话",  # 设置默认标题
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
        )

        self.db.add(session)
        await self.db.flush()

        return session

    async def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        result = await self.db.execute(
            select(Session).where(
                Session.id == session_id,
                Session.user_id == self.user_id,
            )
        )
        return result.scalar_one_or_none()

    async def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        session = await self.get_session(session_id)
        if not session:
            return False

        await self.db.delete(session)
        await self.db.flush()
        return True

    async def list_sessions(
        self,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[List[Session], str | None, bool]:
        """获取会话列表（支持无限滚动）

        Args:
            cursor: 分页游标（base64 编码的最后一条记录的 last_active_at + id）
            limit: 每页数量

        Returns:
            (sessions, next_cursor, has_more): 会话列表、下一页游标、是否还有更多
        """
        import base64

        query = (
            select(Session)
            .where(
                Session.user_id == self.user_id,
                Session.is_archived == 0,
            )
            .order_by(desc(Session.last_active_at), desc(Session.id))
            .limit(limit + 1)  # 多取一条判断是否有更多
        )

        # 解析游标
        if cursor:
            try:
                decoded = base64.b64decode(cursor).decode('utf-8')
                last_active_at_str, last_id = decoded.split('|')
                last_active_at = datetime.fromisoformat(last_active_at_str)
                # 查询比当前游标更晚的记录
                query = query.where(
                    and_(
                        Session.last_active_at <= last_active_at,
                        Session.id < last_id if Session.last_active_at == last_active_at else True
                    )
                )
            except Exception as e:
                print(f"[SessionService] 解析游标失败：{e}")

        result = await self.db.execute(query)
        sessions = list(result.scalars().all())

        # 判断是否有更多
        has_more = len(sessions) > limit
        if has_more:
            sessions = sessions[:limit]

        # 生成下一页游标
        next_cursor = None
        if sessions and has_more:
            last_session = sessions[-1]
            cursor_data = f"{last_session.last_active_at.isoformat()}|{last_session.id}"
            next_cursor = base64.b64encode(cursor_data.encode('utf-8')).decode('utf-8')

        return sessions, next_cursor, has_more

    async def update_session_title(self, session_id: str, title: str) -> Optional[Session]:
        """更新会话标题"""
        session = await self.get_session(session_id)
        if not session:
            return None

        session.title = title[:200] if title else None  # 限制标题长度
        await self.db.flush()
        return session

    async def auto_generate_title(self, session_id: str, first_message: str) -> Optional[Session]:
        """基于首条消息自动生成会话标题（调用 LLM）"""
        session = await self.get_session(session_id)
        if not session:
            return None

        # 调用 LLM 生成标题
        from app.services.agent_service import generate_session_title
        
        title = generate_session_title(first_message)
        

        session.title = title
        await self.db.flush()
        return session

    async def get_message_history(self, session_id: str, limit: int = 20) -> List[Message]:
        """获取消息历史"""
        session = await self.get_session(session_id)
        if not session:
            return []

        result = await self.db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
        )
        messages = list(result.scalars().all())
        # 按时间正序返回
        return list(reversed(messages))

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        sql: Optional[str] = None,
        result: Optional[dict] = None,
        result_truncated: bool = False,
    ) -> Message:
        """添加消息"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"会话不存在：{session_id}")

        # 限制 result 大小
        result_json = None
        if result:
            result_json = json.dumps(result, ensure_ascii=False, default=str)
            # 限制 1MB
            if len(result_json) > 1024 * 1024:
                result_json = result_json[:1024 * 1024 - 100] + '...[truncated]'
                result_truncated = True

        message = Message(
            id=str(uuid.uuid4()),
            session_id=session_id,
            role=role,
            content=content,
            sql=sql,
            result=result_json,
            result_truncated=1 if result_truncated else 0,
            created_at=datetime.utcnow(),
        )

        self.db.add(message)
        await self.db.flush()

        # 更新会话最后活跃时间（触发器也会自动更新）
        session.last_active_at = datetime.utcnow()

        return message

    async def send_message_stream(
        self,
        session_id: str,
        content: str,
        datasource: DataSource,
    ) -> AsyncGenerator[str, None]:
        """发送消息（流式 SSE）"""
        session = await self.get_session(session_id)
        if not session:
            raise ValueError(f"会话不存在：{session_id}")

        # 获取历史消息（最近 10 条）
        history = await self.get_message_history(session_id, limit=10)
        history_dicts = []
        for msg in history:
            msg_dict = {
                "id": msg.id,
                "role": msg.role,
                "content": msg.content,
                "sql": msg.sql,
            }
            if msg.result:
                try:
                    msg_dict["result"] = json.loads(msg.result)
                except:
                    pass
            history_dicts.append(msg_dict)

        # 添加用户消息
        user_msg = await self.add_message(
            session_id=session_id,
            role="user",
            content=content,
        )

        # 流式处理
        result_data = None
        event_count = 0

        async for event in process_query_stream(
            datasource_id=datasource.id,
            db_type=datasource.type,
            host=datasource.host,
            port=datasource.port,
            database=datasource.database_name,
            username=datasource.db_username,
            password=datasource.db_password,
            schema_name=datasource.schema_name,
            query=content,
            context={"last_sql": None},
            history=history_dicts,
        ):
            event_count += 1
            event_type = event.get("type", "message")

            # 记录最终结果
            if event_type == "done":
                result_data = event.get("data")

            # 发送 SSE 事件
            event_json = json.dumps(event, ensure_ascii=False)
            sse_message = f"event: {event_type}\ndata: {event_json}\n\n"

            print(f"[SSE] 发送事件 #{event_count}: {event_type}")
            yield sse_message

            # 强制让出控制权
            import asyncio
            await asyncio.sleep(0)

        print(f"[SSE] 流结束，共发送 {event_count} 个事件")

        # 添加助手消息
        if result_data:
            await self.add_message(
                session_id=session_id,
                role="assistant",
                content=result_data.get("content", ""),
                sql=result_data.get("sql"),
                result=result_data,
            )

        # 如果是第一条消息，自动生成标题
        if len(history) == 0:
            
            await self.auto_generate_title(session_id, content)

    @classmethod
    async def stream_with_own_db(
        cls,
        user_id: str,
        session_id: str,
        content: str,
        datasource: DataSource,
    ) -> AsyncGenerator[str, None]:
        """
        使用独立数据库会话的流式处理方法

        这个方法会创建自己的数据库会话，并在流结束后正确关闭。
        适用于 StreamingResponse 场景，避免依赖注入的数据库会话过早关闭。
        """
        service = await cls.create_for_stream(user_id)
        try:
            async for chunk in service.send_message_stream(
                session_id=session_id,
                content=content,
                datasource=datasource,
            ):
                yield chunk
        finally:
            await service.close()


# ==================== 便捷函数（兼容旧接口） ====================

_sessions: dict = {}


async def create_session(datasource_id: str):
    """创建会话（内存版本，兼容旧接口）"""
    session_id = f"sess_{uuid.uuid4().hex[:12]}"
    _sessions[session_id] = {
        "datasource_id": datasource_id,
        "messages": [],
        "context": {},
        "created_at": datetime.utcnow(),
        "last_active_at": datetime.utcnow(),
    }
    return {"session_id": session_id, "datasource_id": datasource_id}


async def get_session(session_id: str) -> Optional[dict]:
    """获取会话（内存版本，兼容旧接口）"""
    return _sessions.get(session_id)


async def delete_session(session_id: str) -> bool:
    """删除会话（内存版本，兼容旧接口）"""
    if session_id in _sessions:
        del _sessions[session_id]
        return True
    return False


async def get_message_history(session_id: str, limit: int = 20):
    """获取消息历史（内存版本，兼容旧接口）"""
    session = _sessions.get(session_id)
    if not session:
        return None
    return {"session_id": session_id, "messages": session["messages"][-limit:]}


async def send_message_stream(session_id: str, content: str) -> AsyncGenerator[str, None]:
    """发送消息（流式 SSE，内存版本，兼容旧接口）"""
    # 这是旧接口的 placeholder，实际使用请用 SessionService
    raise NotImplementedError("请使用 SessionService 代替")
