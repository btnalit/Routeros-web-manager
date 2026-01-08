# Design Document: RouterOS Web Manager

## Overview

RouterOS Web Manager 是一个轻量级的 Web 管理系统，采用前后端分离架构。前端使用 Vue 3 + Element Plus 构建现代化界面，后端使用 Node.js + Express 提供 RESTful API，通过 RouterOS REST API 与 MikroTik 路由器通信。系统支持 Docker 一键部署。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Container                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Nginx (Port 80)                    │   │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │   │
│  │  │  Vue 3 Frontend │  │  Reverse Proxy /api/*   │   │   │
│  │  │  (Static Files) │  │  → Backend :3000        │   │   │
│  │  └─────────────────┘  └─────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Node.js Backend (Port 3000)             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐   │   │
│  │  │  Interface  │  │     IP      │  │   System   │   │   │
│  │  │  Controller │  │  Controller │  │ Controller │   │   │
│  │  └─────────────┘  └─────────────┘  └────────────┘   │   │
│  │                         │                            │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │           RouterOS API Client               │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  RouterOS API   │
                    │  (Port 443)     │
                    └─────────────────┘
```

## Components and Interfaces

### Backend Components

#### 1. RouterOS API Client (`/backend/src/services/routerosClient.ts`)

负责与 RouterOS REST API 通信的核心服务。

```typescript
interface RouterOSConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useTLS: boolean;
}

interface RouterOSClient {
  connect(config: RouterOSConfig): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  get(path: string): Promise<any[]>;
  post(path: string, data: object): Promise<any>;
  patch(path: string, id: string, data: object): Promise<any>;
  delete(path: string, id: string): Promise<void>;
}
```

#### 2. Interface Controller (`/backend/src/controllers/interfaceController.ts`)

```typescript
// GET /api/interfaces - 获取所有接口
// GET /api/interfaces/:id - 获取单个接口详情
// PATCH /api/interfaces/:id - 更新接口配置
// POST /api/interfaces/:id/enable - 启用接口
// POST /api/interfaces/:id/disable - 禁用接口
```

#### 3. IP Controller (`/backend/src/controllers/ipController.ts`)

```typescript
// IP Address
// GET /api/ip/addresses - 获取所有 IP 地址
// POST /api/ip/addresses - 添加 IP 地址
// PATCH /api/ip/addresses/:id - 更新 IP 地址
// DELETE /api/ip/addresses/:id - 删除 IP 地址

// Routes
// GET /api/ip/routes - 获取所有路由
// POST /api/ip/routes - 添加路由
// PATCH /api/ip/routes/:id - 更新路由
// DELETE /api/ip/routes/:id - 删除路由
```

#### 4. System Controller (`/backend/src/controllers/systemController.ts`)

```typescript
// Scheduler
// GET /api/system/scheduler - 获取所有计划任务
// POST /api/system/scheduler - 添加计划任务
// PATCH /api/system/scheduler/:id - 更新计划任务
// DELETE /api/system/scheduler/:id - 删除计划任务

// Script
// GET /api/system/scripts - 获取所有脚本
// POST /api/system/scripts - 添加脚本
// PATCH /api/system/scripts/:id - 更新脚本
// DELETE /api/system/scripts/:id - 删除脚本
// POST /api/system/scripts/:id/run - 运行脚本
```

#### 5. Connection Controller (`/backend/src/controllers/connectionController.ts`)

```typescript
// GET /api/connection/status - 获取连接状态
// POST /api/connection/connect - 建立连接
// POST /api/connection/disconnect - 断开连接
// GET /api/connection/config - 获取保存的配置
// POST /api/connection/config - 保存配置
```


### Frontend Components

#### 1. 页面结构

```
/frontend/src/
├── views/
│   ├── ConnectionView.vue    # 连接配置页面
│   ├── InterfaceView.vue     # 接口管理页面
│   ├── IpAddressView.vue     # IP 地址管理页面
│   ├── IpRouteView.vue       # 路由管理页面
│   ├── SchedulerView.vue     # 计划任务页面
│   └── ScriptView.vue        # 脚本管理页面
├── components/
│   ├── AppLayout.vue         # 主布局组件
│   ├── SideMenu.vue          # 侧边导航菜单
│   └── ConnectionStatus.vue  # 连接状态指示器
├── api/
│   └── index.ts              # API 请求封装
├── stores/
│   └── connection.ts         # Pinia 状态管理
└── router/
    └── index.ts              # Vue Router 配置
```

#### 2. API 请求封装

```typescript
// /frontend/src/api/index.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const connectionApi = {
  getStatus: () => api.get('/connection/status'),
  connect: (config: RouterOSConfig) => api.post('/connection/connect', config),
  disconnect: () => api.post('/connection/disconnect'),
};

export const interfaceApi = {
  getAll: () => api.get('/interfaces'),
  getById: (id: string) => api.get(`/interfaces/${id}`),
  update: (id: string, data: object) => api.patch(`/interfaces/${id}`, data),
  enable: (id: string) => api.post(`/interfaces/${id}/enable`),
  disable: (id: string) => api.post(`/interfaces/${id}/disable`),
};

export const ipApi = {
  getAddresses: () => api.get('/ip/addresses'),
  addAddress: (data: object) => api.post('/ip/addresses', data),
  updateAddress: (id: string, data: object) => api.patch(`/ip/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/ip/addresses/${id}`),
  getRoutes: () => api.get('/ip/routes'),
  addRoute: (data: object) => api.post('/ip/routes', data),
  updateRoute: (id: string, data: object) => api.patch(`/ip/routes/${id}`, data),
  deleteRoute: (id: string) => api.delete(`/ip/routes/${id}`),
};

export const systemApi = {
  getSchedulers: () => api.get('/system/scheduler'),
  addScheduler: (data: object) => api.post('/system/scheduler', data),
  updateScheduler: (id: string, data: object) => api.patch(`/system/scheduler/${id}`, data),
  deleteScheduler: (id: string) => api.delete(`/system/scheduler/${id}`),
  getScripts: () => api.get('/system/scripts'),
  addScript: (data: object) => api.post('/system/scripts', data),
  updateScript: (id: string, data: object) => api.patch(`/system/scripts/${id}`, data),
  deleteScript: (id: string) => api.delete(`/system/scripts/${id}`),
  runScript: (id: string) => api.post(`/system/scripts/${id}/run`),
};
```

## Data Models

### RouterOS 连接配置

```typescript
interface RouterOSConfig {
  host: string;        // RouterOS 地址
  port: number;        // API 端口，默认 443
  username: string;    // 用户名
  password: string;    // 密码
  useTLS: boolean;     // 是否使用 HTTPS
}
```

### Interface 数据模型

```typescript
interface NetworkInterface {
  '.id': string;           // RouterOS 内部 ID
  name: string;            // 接口名称
  type: string;            // 接口类型 (ether, vlan, bridge, etc.)
  'mac-address': string;   // MAC 地址
  mtu: number;             // MTU 值
  disabled: boolean;       // 是否禁用
  running: boolean;        // 是否运行中
  comment?: string;        // 备注
}
```

### IP Address 数据模型

```typescript
interface IpAddress {
  '.id': string;           // RouterOS 内部 ID
  address: string;         // IP 地址 (CIDR 格式)
  network: string;         // 网络地址
  interface: string;       // 绑定接口
  disabled: boolean;       // 是否禁用
  comment?: string;        // 备注
}
```

### Route 数据模型

```typescript
interface Route {
  '.id': string;           // RouterOS 内部 ID
  'dst-address': string;   // 目标地址
  gateway: string;         // 网关
  'gateway-status'?: string; // 网关状态
  distance: number;        // 路由距离
  scope: number;           // 作用域
  disabled: boolean;       // 是否禁用
  active: boolean;         // 是否激活
  dynamic: boolean;        // 是否动态路由
  comment?: string;        // 备注
}
```

### Scheduler 数据模型

```typescript
interface Scheduler {
  '.id': string;           // RouterOS 内部 ID
  name: string;            // 任务名称
  'start-date'?: string;   // 开始日期
  'start-time': string;    // 开始时间
  interval: string;        // 执行间隔
  'on-event': string;      // 关联脚本名称
  disabled: boolean;       // 是否禁用
  'run-count': number;     // 运行次数
  'next-run'?: string;     // 下次运行时间
  comment?: string;        // 备注
}
```

### Script 数据模型

```typescript
interface Script {
  '.id': string;           // RouterOS 内部 ID
  name: string;            // 脚本名称
  source: string;          // 脚本内容
  owner: string;           // 所有者
  policy: string[];        // 权限策略
  'run-count': number;     // 运行次数
  'last-started'?: string; // 最后运行时间
  comment?: string;        // 备注
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: IP 地址格式验证

*For any* 字符串输入，IP 地址验证函数应正确识别有效的 CIDR 格式（如 192.168.1.1/24）并拒绝无效格式。

**Validates: Requirements 3.3, 3.10**

### Property 2: 路由参数验证

*For any* 路由配置对象，验证函数应确保目标地址为有效 CIDR 格式，网关为有效 IP 地址或接口名称。

**Validates: Requirements 3.7, 3.10**

### Property 3: 配置持久化往返一致性

*For any* 有效的 RouterOS 连接配置，保存后再读取应得到等价的配置对象。

**Validates: Requirements 1.2, 5.5**

### Property 4: API 响应错误信息完整性

*For any* 失败的 API 操作，响应对象应包含 error 字段且 error 消息非空。

**Validates: Requirements 1.3, 2.6, 3.11, 4.12, 6.5**

### Property 5: 数据模型字段完整性

*For any* 从 RouterOS API 返回的数据对象（Interface、IP Address、Route、Scheduler、Script），转换后的前端数据模型应包含所有必要的显示字段。

**Validates: Requirements 2.2, 3.2, 3.6, 4.2, 4.7**

### Property 6: 启用/禁用状态切换一致性

*For any* 可禁用的资源（Interface、Scheduler），执行启用操作后 disabled 应为 false，执行禁用操作后 disabled 应为 true。

**Validates: Requirements 2.5, 4.6**

### Property 7: Scheduler 时间间隔格式验证

*For any* Scheduler 配置，interval 字段应符合 RouterOS 时间格式（如 1d, 1h30m, 00:30:00）。

**Validates: Requirements 4.3**

## Error Handling

### 连接错误

| 错误类型 | 处理方式 |
|---------|---------|
| 网络不可达 | 显示 "无法连接到 RouterOS，请检查网络" |
| 认证失败 | 显示 "用户名或密码错误" |
| 连接超时 | 显示 "连接超时，请检查地址和端口" |
| TLS 证书错误 | 显示 "证书验证失败" 并提供忽略选项 |

### API 错误

| 错误类型 | 处理方式 |
|---------|---------|
| 资源不存在 | 显示 "资源不存在或已被删除" |
| 权限不足 | 显示 "权限不足，请检查用户权限" |
| 参数无效 | 显示 RouterOS 返回的具体错误信息 |
| 操作冲突 | 显示 "操作冲突，请刷新后重试" |

### 前端错误

| 错误类型 | 处理方式 |
|---------|---------|
| 表单验证失败 | 在对应字段下方显示红色错误提示 |
| 网络请求失败 | 显示 Toast 提示并提供重试按钮 |
| 会话过期 | 跳转到连接配置页面 |

## Testing Strategy

### 单元测试

使用 Vitest 进行单元测试：

- **验证函数测试**：测试 IP 地址、路由、时间间隔等格式验证
- **数据转换测试**：测试 RouterOS API 响应到前端数据模型的转换
- **错误处理测试**：测试各种错误场景的处理逻辑

### 属性测试

使用 fast-check 进行属性测试：

- **Property 1**: 生成随机字符串测试 IP 地址验证函数
- **Property 2**: 生成随机路由配置测试验证函数
- **Property 3**: 生成随机配置测试持久化往返一致性
- **Property 4**: 模拟各种 API 错误测试错误响应格式
- **Property 5**: 生成随机 API 响应测试数据模型转换
- **Property 6**: 生成随机资源状态测试启用/禁用操作
- **Property 7**: 生成随机时间字符串测试间隔格式验证

### 集成测试

- **API 端点测试**：测试各 Controller 的 HTTP 端点
- **RouterOS 模拟测试**：使用 Mock 服务模拟 RouterOS API 响应

### E2E 测试

使用 Playwright 进行端到端测试：

- 连接配置流程
- 各模块的 CRUD 操作流程
- 错误场景处理
