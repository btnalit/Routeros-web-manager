# RouterOS Web Manager

基于 Vue 3 + Element Plus 的 RouterOS Web 管理界面，通过 RouterOS API 协议（端口 8728/8729）实现对 MikroTik 路由器的远程管理。

## 功能特性

- 🔗 **连接管理** - RouterOS 设备连接配置，支持 API 和 API-SSL 连接，连接信息自动保存
- 🌐 **接口管理** - 查看和配置网络接口（启用/禁用/编辑）
  - 支持 L2TP Client 接口的创建、编辑、删除
  - 支持 PPPoE Client 接口的创建、编辑、删除
- 📍 **IP 地址管理** - IP 地址的增删改查
- 🛣️ **路由管理** - 静态路由配置
- 🏊 **IP Pool 管理** - 地址池的创建、编辑、删除
- 📡 **DHCP Client** - DHCP 客户端管理（启用/禁用/编辑/删除）
- 🖥️ **DHCP Server** - DHCP 服务器完整管理
  - DHCP 服务器配置
  - Networks 网络配置
  - Leases 租约管理（支持静态绑定）
- 🧦 **Socksify** - SOCKS5 代理配置管理
- ⏰ **计划任务** - Scheduler 任务管理（查看/启用/禁用/编辑/删除）
- 📜 **脚本管理** - Script 脚本编辑和执行，支持中文注释

## 技术栈

### 前端

- Vue 3 + TypeScript
- Element Plus UI 组件库
- Vue Router
- Pinia 状态管理
- Vite 构建工具

### 后端

- Node.js + Express
- TypeScript
- node-routeros（RouterOS API 协议）
- Winston 日志
- patch-package（UTF-8 编码支持）

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- RouterOS 设备（需开启 API 服务）

### 安装依赖

```bash
# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

### 开发环境启动

```bash
# 启动后端服务器 (端口 3099)
cd backend && npm run dev

# 启动前端开发服务器 (端口 5173)
cd frontend && npm run dev
```

访问 `http://localhost:5173` 打开管理界面。

### 构建生产版本

```bash
# 构建后端
cd backend && npm run build

# 构建前端
cd frontend && npm run build
```

## Docker 部署

### 使用预构建镜像（推荐）

```bash
# 拉取镜像
docker pull ghcr.io/btnalit/routeros-web-manager:latest

# 运行容器
docker run -d \
  --name routeros-web-manager \
  -p 8080:3099 \
  -v routeros-data:/app/backend/data \
  -v routeros-logs:/app/backend/logs \
  ghcr.io/btnalit/routeros-web-manager:latest
```

### 使用 Docker Compose

```bash
# 简单部署（单容器）
docker-compose -f docker-compose.simple.yml up -d

# 完整部署（包含 Nginx 反向代理）
docker-compose --profile with-nginx up -d
```

### 手动构建镜像

```bash
# 构建镜像
docker build -t routeros-web-manager .

# 运行容器
docker run -d \
  --name routeros-web-manager \
  -p 8080:3099 \
  -v routeros-data:/app/backend/data \
  -v routeros-logs:/app/backend/logs \
  routeros-web-manager
```

### 环境变量

| 变量名 | 默认值 | 说明 |
| ------ | ------ | ---- |
| PORT | 8080 | 外部访问端口（映射到容器 3099） |
| LOG_LEVEL | info | 日志级别 |
| NGINX_HTTP_PORT | 80 | Nginx HTTP 端口 |
| NGINX_HTTPS_PORT | 443 | Nginx HTTPS 端口 |

### 数据持久化

Docker 部署自动创建数据卷：

- `routeros-web-manager-data`: 连接配置
- `routeros-web-manager-logs`: 日志文件

### HTTPS 配置

1. 将证书放入 `certs/` 目录：
   - `certs/server.crt`
   - `certs/server.key`

2. 编辑 `nginx.conf`，取消 HTTPS server 块注释

3. 启动：

   ```bash
   docker-compose --profile with-nginx up -d
   ```

## 项目结构

```text
routeros-web-manager/
├── backend/                 # 后端 API 服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── routes/          # 路由定义
│   │   ├── services/        # 业务逻辑
│   │   ├── types/           # 类型定义
│   │   ├── utils/           # 工具函数
│   │   └── index.ts         # 入口文件
│   ├── patches/             # node-routeros UTF-8 补丁
│   └── package.json
├── frontend/                # 前端 Vue 应用
│   ├── src/
│   │   ├── api/             # API 请求封装
│   │   ├── components/      # 公共组件
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # Pinia 状态
│   │   ├── views/           # 页面组件
│   │   └── main.ts          # 入口文件
│   └── package.json
├── Dockerfile               # Docker 构建文件
├── docker-compose.yml       # Docker Compose 配置
├── docker-compose.simple.yml # 简化版 Docker Compose
├── nginx.conf               # Nginx 配置
└── README.md
```

## API 端点

后端服务运行在端口 `3099`，主要端点：

- `GET /api/health` - 健康检查
- `GET /api/connection/status` - 连接状态
- `POST /api/connection/connect` - 建立连接
- `POST /api/connection/disconnect` - 断开连接
- `GET /api/interfaces` - 接口列表
- `POST /api/interfaces/l2tp-client` - 创建 L2TP Client
- `POST /api/interfaces/pppoe-client` - 创建 PPPoE Client
- `GET /api/ip/addresses` - IP 地址列表
- `GET /api/ip/routes` - 路由列表
- `GET /api/ip/pools` - IP Pool 列表
- `GET /api/ip/dhcp-client` - DHCP Client 列表
- `GET /api/ip/dhcp-server` - DHCP Server 列表
- `GET /api/ip/dhcp-server/networks` - DHCP Networks 列表
- `GET /api/ip/dhcp-server/leases` - DHCP Leases 列表
- `GET /api/ip/socks` - Socksify 列表
- `GET /api/system/scheduler` - 计划任务列表
- `GET /api/system/scripts` - 脚本列表

## RouterOS 配置

确保 RouterOS 设备已启用 API 服务：

```routeros
# 启用 API 服务（端口 8728）
/ip service set api disabled=no port=8728

# 启用 API-SSL 服务（端口 8729，可选）
/ip service set api-ssl disabled=no port=8729

# 创建 API 用户（建议使用 full 权限组）
/user add name=api password=yourpassword group=full
```

## 中文支持

本项目通过 patch-package 对 node-routeros 库进行了补丁，将编码从 win1252 改为 UTF-8，完整支持中文字符的读取和写入。

补丁文件位于 `backend/patches/node-routeros+1.6.8.patch`。

## 许可证

MIT License
