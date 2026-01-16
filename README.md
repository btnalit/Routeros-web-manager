# RouterOS Web Manager

基于 Vue 3 + Element Plus 的 RouterOS Web 管理界面，通过 RouterOS API 协议（端口 8728/8729）实现对 MikroTik 路由器的远程管理。

## 功能特性

### 基础管理

- 🔗 **连接管理** - RouterOS 设备连接配置，支持 API 和 API-SSL 连接，连接信息自动保存
- 📊 **系统监控** - 实时显示 CPU、内存、磁盘使用率，系统信息（已整合至运维仪表盘）
- 🌐 **接口管理** - 查看和配置网络接口（启用/禁用/编辑）
  - 支持 L2TP Client 接口的创建、编辑、删除
  - 支持 PPPoE Client 接口的创建、编辑、删除
- 🔌 **VETH 接口** - 虚拟以太网接口管理，支持 IPv4/IPv6 多地址配置
- 📍 **IP 地址管理** - IP 地址的增删改查
- 🛣️ **路由管理** - 静态路由配置
- 🏊 **IP Pool 管理** - 地址池的创建、编辑、删除
- 📡 **DHCP Client** - DHCP 客户端管理（启用/禁用/编辑/删除）
- 🖥️ **DHCP Server** - DHCP 服务器完整管理
  - DHCP 服务器配置
  - Networks 网络配置
  - Leases 租约管理（支持静态绑定）

### IPv6 管理

- 🌍 **IPv6 地址管理** - 增删改查
- 📡 **DHCPv6 客户端** - Release/Renew 操作
- 🔍 **邻居发现（ND）** - ND 配置管理
- 📋 **IPv6 邻居表** - 分页显示
- 🛣️ **IPv6 路由** - 路由管理
- 🔥 **IPv6 防火墙** - Filter 规则管理

### 防火墙管理

- 🔥 **Filter 规则** - 过滤规则管理
- 🔄 **NAT 规则** - 地址转换规则
- 🏷️ **Mangle 规则** - 标记规则
- 📋 **Address List** - 地址列表管理

### 容器与系统

- 🐳 **容器管理** - Docker 容器管理（启动/停止/环境变量/挂载点）
- 🧦 **Socksify** - SOCKS5 代理配置管理
- ⏰ **计划任务** - Scheduler 任务管理
- 📜 **脚本管理** - Script 脚本编辑和执行，支持中文注释
- ⚡ **电源管理** - 系统重启和关机操作（带安全确认）

### AI 智能功能

- 🤖 **AI 智能助手** - 基于大语言模型的 RouterOS 配置助手
  - 支持多种 AI 服务商（OpenAI、DeepSeek、Gemini、通义千问、智谱）
  - 自然语言交互，智能生成 RouterOS 命令
  - 一键执行 AI 生成的命令，结果自动反馈给 AI 分析
  - 会话管理，支持多轮对话和历史记录
  - 流式响应，实时显示 AI 回复

- 🛡️ **AI-Ops 智能运维** - 全方位智能运维平台
  - **统一运维仪表盘** - 首页集成系统信息、资源监控、流量图表、告警和任务概览
  - **实时监控仪表盘** - CPU、内存、磁盘、接口流量实时监控
  - **接口流量历史** - 支持服务重启后自动恢复历史流量数据
  - **智能告警系统** - 自定义告警规则，支持多级别告警（信息/警告/严重/紧急）
  - **统一告警管道** - AlertPipeline 整合告警引擎和 Syslog 接收器
  - **定时巡检任务** - Cron 表达式调度，自动执行巡检和备份
  - **配置快照管理** - 自动/手动备份配置，支持差异对比和一键恢复
  - **健康报告生成** - 自动生成系统健康报告，支持 Markdown/PDF 导出
  - **故障自愈引擎** - 内置故障模式识别，支持自动修复（PPPoE 断线重连、接口重启等）
  - **多渠道通知** - 支持 Web 推送、Webhook（企业微信/钉钉/飞书）、邮件通知
  - **审计日志** - 完整的操作审计记录
  - **并行初始化** - 优化模块启动性能，支持并行加载

## 技术栈

### 前端

- Vue 3 + TypeScript
- Element Plus UI 组件库
- Vue Router
- Pinia 状态管理
- ECharts 图表库
- Vite 构建工具

### 后端

- Node.js + Express
- TypeScript
- node-routeros（RouterOS API 协议）
- node-cron（定时任务调度）
- nodemailer（邮件发送）
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
| SYSLOG_PORT | 514 | Syslog UDP 端口（接收 RouterOS 日志） |
| NGINX_HTTP_PORT | 80 | Nginx HTTP 端口 |
| NGINX_HTTPS_PORT | 443 | Nginx HTTPS 端口 |

### 数据持久化

Docker 部署自动创建数据卷：

- `routeros-web-manager-data`: 连接配置和 AI-Ops 数据
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
│   │   │   └── ai-ops/      # AI-Ops 智能运维服务
│   │   ├── types/           # 类型定义
│   │   ├── utils/           # 工具函数
│   │   └── index.ts         # 入口文件
│   ├── data/                # 数据存储（gitignore）
│   │   └── ai-ops/          # AI-Ops 运维数据
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

### 系统

- `GET /api/health` - 健康检查
- `GET /api/dashboard/resource` - 系统资源信息

### 连接管理

- `GET /api/connection/status` - 连接状态
- `POST /api/connection/connect` - 建立连接
- `POST /api/connection/disconnect` - 断开连接

### 接口管理

- `GET /api/interfaces` - 接口列表
- `POST /api/interfaces/l2tp-client` - 创建 L2TP Client
- `POST /api/interfaces/pppoe-client` - 创建 PPPoE Client
- `GET /api/interfaces/veth` - VETH 接口列表
- `POST /api/interfaces/veth` - 创建 VETH 接口

### IP 管理

- `GET /api/ip/addresses` - IP 地址列表
- `GET /api/ip/routes` - 路由列表
- `GET /api/ip/pools` - IP Pool 列表
- `GET /api/ip/dhcp-client` - DHCP Client 列表
- `GET /api/ip/dhcp-server` - DHCP Server 列表
- `GET /api/ip/socks` - Socksify 列表

### 防火墙

- `GET /api/ip/firewall/filter` - Filter 规则列表
- `GET /api/ip/firewall/nat` - NAT 规则列表
- `GET /api/ip/firewall/mangle` - Mangle 规则列表
- `GET /api/ip/firewall/address-list` - 地址列表

### 容器管理

- `GET /api/container` - 容器列表
- `POST /api/container/:id/start` - 启动容器
- `POST /api/container/:id/stop` - 停止容器

### 系统管理

- `GET /api/system/scheduler` - 计划任务列表
- `GET /api/system/scripts` - 脚本列表
- `POST /api/system/reboot` - 重启系统
- `POST /api/system/shutdown` - 关闭系统

### IPv6 管理

- `GET /api/ipv6/addresses` - IPv6 地址列表
- `GET /api/ipv6/dhcp-client` - DHCPv6 客户端列表
- `GET /api/ipv6/nd` - ND 配置列表
- `GET /api/ipv6/neighbors` - IPv6 邻居表
- `GET /api/ipv6/routes` - IPv6 路由列表
- `GET /api/ipv6/firewall/filter` - IPv6 防火墙规则

### AI 智能助手

- `GET /api/ai/configs` - AI 服务配置列表
- `POST /api/ai/configs` - 创建 AI 服务配置
- `GET /api/ai/sessions` - 会话列表
- `POST /api/ai/chat/stream` - 流式对话（SSE）
- `POST /api/ai/scripts/execute` - 执行 RouterOS 命令

### AI-Ops 智能运维

- `GET /api/ai-ops/dashboard` - 运维仪表盘数据
- `GET /api/ai-ops/metrics/latest` - 最新指标
- `GET /api/ai-ops/metrics/history` - 历史指标
- `GET /api/ai-ops/alerts/rules` - 告警规则列表
- `GET /api/ai-ops/alerts/events` - 告警事件列表
- `GET /api/ai-ops/alerts/events/active` - 活跃告警
- `GET /api/ai-ops/scheduler/tasks` - 调度任务列表
- `GET /api/ai-ops/snapshots` - 配置快照列表
- `POST /api/ai-ops/snapshots` - 创建快照
- `GET /api/ai-ops/snapshots/diff` - 快照对比
- `GET /api/ai-ops/reports` - 健康报告列表
- `POST /api/ai-ops/reports/generate` - 生成报告
- `GET /api/ai-ops/patterns` - 故障模式列表
- `GET /api/ai-ops/remediations` - 修复历史
- `GET /api/ai-ops/channels` - 通知渠道列表
- `GET /api/ai-ops/audit` - 审计日志

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

### Syslog 配置（可选）

如需使用 Syslog 日志接收功能，需要在 RouterOS 中配置远程 Syslog：

```routeros
# 添加远程 Syslog 服务器（替换为实际 IP 地址）
/system logging action add name=remote target=remote remote=192.168.1.100 remote-port=514

# 配置要发送的日志类型
/system logging add topics=info action=remote
/system logging add topics=warning action=remote
/system logging add topics=error action=remote
/system logging add topics=critical action=remote

# 或者发送所有日志
/system logging add topics=!debug action=remote
```

注意：
- 需要在 Web 管理界面的「智能运维 → 系统设置 → Syslog 配置」中启用 Syslog 接收功能
- Docker 部署时 UDP 514 端口已自动暴露
- 确保防火墙允许 UDP 514 端口的入站流量

## AI-Ops 通知渠道配置

### 企业微信机器人

```json
{
  "请求 URL": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的机器人key",
  "请求头": {"Content-Type": "application/json"},
  "请求体模板": {
    "msgtype": "markdown",
    "markdown": {
      "content": "## 🚨 RouterOS 运维告警\n\n**{{title}}**\n\n{{body}}\n\n---\n> **告警类型**: {{type}}\n> **告警级别**: <font color=\"warning\">{{severity}}</font>\n> **触发时间**: {{timestamp}}"
    }
  }
}
```

### 钉钉机器人

```json
{
  "请求 URL": "https://oapi.dingtalk.com/robot/send?access_token=你的token",
  "请求头": {"Content-Type": "application/json"},
  "请求体模板": {
    "msgtype": "markdown",
    "markdown": {
      "title": "{{title}}",
      "text": "## {{title}}\n\n{{body}}\n\n- 类型: {{type}}\n- 级别: {{severity}}\n- 时间: {{timestamp}}"
    }
  }
}
```

## 中文支持

本项目通过 patch-package 对 node-routeros 库进行了补丁，将编码从 win1252 改为 UTF-8，完整支持中文字符的读取和写入。

补丁文件位于 `backend/patches/node-routeros+1.6.8.patch`。

## 许可证

本项目采用MIT开源许可证，允许自由使用、修改和分发代码。使用本项目的代码时需满足：

在副本中保留原始版权声明
不得使用项目作者的名义进行背书
完整条款请参见LICENSE文件。
