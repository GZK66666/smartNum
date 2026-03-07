# smartNum Frontend

智能问数系统前端应用，基于 React + TypeScript + Vite + Tailwind CSS 构建。

## 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **React Router** - 路由管理
- **Axios** - HTTP 客户端
- **Lucide React** - 图标库

## 项目结构

```
frontend/
├── public/              # 静态资源
├── src/
│   ├── components/      # 通用组件
│   │   ├── Layout.tsx   # 布局组件
│   │   └── DataTable.tsx # 数据表格组件
│   ├── pages/           # 页面组件
│   │   ├── DataSourcePage.tsx    # 数据源列表页
│   │   ├── NewDataSourcePage.tsx # 添加数据源页
│   │   └── ChatPage.tsx          # 对话页面
│   ├── services/        # API 服务
│   │   └── api.ts       # API 客户端
│   ├── store/           # 状态管理
│   │   └── index.ts     # Zustand store
│   ├── types/           # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx          # 应用入口
│   ├── main.tsx         # 渲染入口
│   └── index.css        # 全局样式
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 功能模块

### 1. 数据源管理
- 数据源列表展示
- 添加新数据源（MySQL/PostgreSQL/SQLite）
- 连接测试
- 删除数据源

### 2. 对话交互
- 类似 ChatGPT 的聊天界面
- 自然语言输入
- 多轮对话支持
- 流式响应显示

### 3. 结果展示
- 表格数据展示
- 排序、分页功能
- SQL 语句展示
- 复制功能

## 开发指南

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## API 代理配置

开发环境下，API 请求会自动代理到后端服务：

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
}
```

## 设计规范

### 颜色主题

- 主色调：`primary-*` (蓝色系)
- 强调色：`accent-*` (紫色系)
- 背景色：`slate-950` / `slate-900`
- 文字色：`slate-100` / `slate-300`

### 组件样式

使用预定义的 CSS 类：

- `.btn-primary` - 主要按钮
- `.btn-secondary` - 次要按钮
- `.btn-ghost` - 幽灵按钮
- `.input-field` - 输入框
- `.card` - 卡片容器
- `.glass` - 毛玻璃效果

### 动画效果

- `animate-fade-in` - 淡入效果
- `animate-slide-up` - 上滑效果
- `animate-pulse-slow` - 缓慢脉冲

## 注意事项

1. 确保 Node.js 版本 >= 18
2. 开发前确保后端服务已启动
3. 生产环境需配置正确的 API 地址