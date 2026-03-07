# SmartNum

<p align="center">
  <strong>智能问数系统 - 通过自然语言查询数据库</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#使用指南">使用指南</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#项目结构">项目结构</a> •
  <a href="#api-文档">API 文档</a>
</p>

---

## 简介

SmartNum 是一款智能问数系统，让非技术用户也能通过自然语言查询数据库。用户只需用日常语言提问，系统会自动将问题转换为 SQL 并执行，返回查询结果。

### 核心价值

- 🗣️ **自然语言交互** - 无需学习 SQL，用日常语言提问即可获得数据
- 🔄 **多轮对话** - 支持追问和深入分析，逐步细化数据洞察
- ⚙️ **灵活配置** - 用户可自行配置数据源，无需依赖 IT 部门
- 🔒 **安全可靠** - SQL 注入防护、敏感数据保护、查询超时控制

---

## 功能特性

| 功能 | 描述 |
|------|------|
| 📊 数据源配置 | 支持 MySQL、PostgreSQL、SQLite，动态配置数据库连接 |
| 🤖 自然语言查询 | 基于 LLM 的智能 SQL 生成，支持复杂查询 |
| 💬 多轮对话 | 上下文理解，支持追问、筛选、下钻等操作 |
| 📈 结果展示 | 表格展示、排序、分页、SQL 语句查看 |
| ⚡ 流式响应 | SSE 实时返回处理状态，提升用户体验 |
| 🔐 安全机制 | 只允许 SELECT 语句，密码 AES 加密存储 |

---

## 快速开始

### 环境要求

- Python >= 3.10
- Node.js >= 18.0 (前端开发)
- MySQL / PostgreSQL / SQLite 数据库

### 后端安装

```bash
# 克隆项目
git clone https://github.com/your-username/smartnum.git
cd smartnum

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置 ANTHROPIC_API_KEY

# 启动后端服务
uvicorn app.main:app --reload --port 8000
```

### 前端安装

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 访问应用

- 前端界面: http://localhost:5173
- API 文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 使用指南

### 1. 配置数据源

1. 访问前端界面，点击「添加数据源」
2. 选择数据库类型（MySQL/PostgreSQL/SQLite）
3. 填写连接信息：
   - 名称：数据源显示名称
   - 主机地址：数据库服务器地址
   - 端口：数据库端口
   - 数据库名：数据库名称
   - 用户名/密码：数据库凭证
4. 点击「测试连接」验证配置
5. 保存数据源

### 2. 开始对话

1. 在数据源列表中选择一个数据源
2. 点击「开始对话」进入聊天界面
3. 输入自然语言问题，例如：
   - "查询所有用户"
   - "统计上个月销售额前10的产品"
   - "每个部门的员工数量是多少"
4. 查看查询结果和生成的 SQL

### 3. 多轮追问

系统支持基于上下文的追问，例如：

```
用户: 查询上个月的销售数据
系统: [返回销售数据表格]

用户: 按地区拆分
系统: [返回按地区分组的销售数据]

用户: 只要北京的
系统: [返回北京地区的销售数据]
```

---

## 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | >= 3.10 | 编程语言 |
| FastAPI | >= 0.115 | Web 框架 |
| SQLAlchemy | >= 2.0 | ORM (异步) |
| LangChain | >= 0.3 | LLM 框架 |
| Pydantic | >= 2.0 | 数据验证 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.3 | 类型安全 |
| Vite | 5.1 | 构建工具 |
| TailwindCSS | 3.4 | 样式框架 |
| Zustand | 4.5 | 状态管理 |

### 数据库支持

- MySQL (aiomysql)
- PostgreSQL (asyncpg)
- SQLite (aiosqlite)

---

## 项目结构

```
smartnum/
├── app/                          # 后端代码
│   ├── main.py                   # FastAPI 主应用
│   ├── core/                     # 核心模块
│   │   ├── config.py             # 配置管理
│   │   └── security.py           # 安全模块 (密码加密)
│   ├── models/                   # 数据模型
│   │   └── schemas.py            # Pydantic 模型
│   ├── routers/                  # API 路由
│   │   ├── datasources.py        # 数据源管理
│   │   └── sessions.py           # 会话管理
│   └── services/                 # 业务服务
│       ├── db_service.py         # 数据库连接
│       ├── datasource_service.py # 数据源服务
│       ├── session_service.py    # 会话服务
│       └── agent_service.py      # LLM 智能体
├── frontend/                     # 前端代码
│   ├── src/
│   │   ├── components/           # UI 组件
│   │   │   ├── Layout.tsx        # 布局组件
│   │   │   └── DataTable.tsx     # 数据表格
│   │   ├── pages/                # 页面组件
│   │   │   ├── DataSourcePage.tsx    # 数据源列表
│   │   │   ├── NewDataSourcePage.tsx # 添加数据源
│   │   │   └── ChatPage.tsx          # 对话界面
│   │   ├── services/             # API 服务
│   │   │   └── api.ts            # HTTP 客户端
│   │   ├── store/                # 状态管理
│   │   │   └── index.ts          # Zustand Store
│   │   └── types/                # TypeScript 类型
│   │       └── index.ts          # 类型定义
│   ├── package.json
│   └── vite.config.ts
├── docs/                         # 文档
│   └── PRD.md                    # 产品需求文档
├── 参考文档/                      # 参考资料
│   ├── langchain-deepagents-docs.md
│   └── text2sql参考文档.md
├── requirements.txt              # Python 依赖
├── pyproject.toml                # 项目配置
├── .env.example                  # 环境变量模板
└── README.md                     # 项目说明
```

---

## API 文档

### 数据源管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/datasources` | 获取数据源列表 |
| POST | `/api/datasources` | 添加数据源 |
| POST | `/api/datasources/test` | 测试连接 |
| DELETE | `/api/datasources/{id}` | 删除数据源 |
| GET | `/api/datasources/{id}/schema` | 获取数据库 Schema |

### 会话管理

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/sessions` | 创建会话 |
| DELETE | `/api/sessions/{id}` | 删除会话 |
| POST | `/api/sessions/{id}/messages` | 发送消息 |
| POST | `/api/sessions/{id}/messages/stream` | 流式发送消息 (SSE) |
| GET | `/api/sessions/{id}/messages` | 获取对话历史 |

详细 API 文档请访问: http://localhost:8000/docs

---

## 环境变量

创建 `.env` 文件并配置以下变量：

```env
# LLM API Key (必需)
ANTHROPIC_API_KEY=your-api-key-here

# 服务配置 (可选)
HOST=0.0.0.0
PORT=8000
DEBUG=false

# 安全配置 (可选)
SECRET_KEY=your-secret-key

# 数据库配置 (可选)
MAX_RESULT_ROWS=1000
QUERY_TIMEOUT=30
```

---

## 开发指南

### 运行测试

```bash
# 安装开发依赖
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx

# 运行测试
pytest
```

### 代码规范

```bash
# 安装 ruff
pip install ruff

# 代码检查
ruff check .

# 代码格式化
ruff format .
```

### 前端开发

```bash
cd frontend

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

---

## 路线图

### v1.0 (当前版本)

- [x] 数据源配置 (MySQL/PostgreSQL/SQLite)
- [x] 自然语言转 SQL
- [x] 多轮对话
- [x] 查询结果展示
- [x] 流式响应 (SSE)

### v1.1 (规划中)

- [ ] 数据可视化 (图表)
- [ ] 查询历史记录
- [ ] 查询收藏功能
- [ ] 导出 CSV/Excel

### v2.0 (未来规划)

- [ ] 持久化存储
- [ ] 用户认证与权限管理
- [ ] 团队协作功能
- [ ] 自定义数据模型

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Python Web 框架
- [LangChain](https://langchain.com/) - LLM 应用开发框架
- [React](https://react.dev/) - 用户界面 JavaScript 库
- [TailwindCSS](https://tailwindcss.com/) - 实用优先的 CSS 框架

---

<p align="center">
  Made with ❤️ by SmartNum Team
</p>