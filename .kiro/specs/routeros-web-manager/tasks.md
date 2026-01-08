# Implementation Plan: RouterOS Web Manager

## Overview

基于 Vue 3 + Element Plus 前端和 Node.js + Express 后端的 RouterOS Web 管理系统实现计划。采用增量开发方式，先搭建基础架构，再逐步实现各功能模块。

## Tasks

- [x] 1. 项目初始化和基础架构
  - [x] 1.1 清理现有代码，创建新的项目结构
    - 删除 backend 和 frontend 目录下的旧代码
    - 创建新的 backend 目录结构：src/controllers, src/services, src/routes, src/types, src/utils
    - 创建新的 frontend 目录结构：src/views, src/components, src/api, src/stores, src/router
    - _Requirements: 5.1, 5.2, 6.1_

  - [x] 1.2 初始化后端项目
    - 配置 package.json，安装 express, axios, cors, dotenv, winston
    - 创建 TypeScript 配置
    - 创建基础 Express 应用入口 src/index.ts
    - _Requirements: 5.3, 5.4_

  - [x] 1.3 初始化前端项目
    - 使用 Vite 创建 Vue 3 + TypeScript 项目
    - 安装 element-plus, vue-router, pinia, axios
    - 配置 Element Plus 按需导入
    - _Requirements: 6.1_

- [x] 2. RouterOS API Client 实现
  - [x] 2.1 创建 RouterOS API Client 服务
    - 实现 RouterOSClient 类，封装 HTTP 请求
    - 实现 connect, disconnect, isConnected 方法
    - 实现 get, post, patch, delete 通用方法
    - 处理 TLS 证书验证选项
    - _Requirements: 1.2, 1.3, 1.5_

  - [x] 2.2 创建数据类型定义
    - 定义 RouterOSConfig 接口
    - 定义 NetworkInterface, IpAddress, Route, Scheduler, Script 接口
    - 定义 API 响应类型
    - _Requirements: 2.2, 3.2, 3.6, 4.2, 4.7_

  - [ ]* 2.3 编写 IP 地址格式验证属性测试
    - **Property 1: IP 地址格式验证**
    - **Validates: Requirements 3.3, 3.10**

  - [ ]* 2.4 编写路由参数验证属性测试
    - **Property 2: 路由参数验证**
    - **Validates: Requirements 3.7, 3.10**

- [x] 3. Connection 模块实现
  - [x] 3.1 创建 Connection Controller
    - 实现 GET /api/connection/status 获取连接状态
    - 实现 POST /api/connection/connect 建立连接
    - 实现 POST /api/connection/disconnect 断开连接
    - 实现 GET/POST /api/connection/config 配置管理
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 3.2 实现配置持久化
    - 使用 JSON 文件存储连接配置
    - 实现配置加载和保存逻辑
    - _Requirements: 5.5_

  - [ ]* 3.3 编写配置持久化属性测试
    - **Property 3: 配置持久化往返一致性**
    - **Validates: Requirements 1.2, 5.5**

- [x] 4. Checkpoint - 后端基础完成
  - 确保 RouterOS API Client 可以正常连接
  - 确保配置持久化正常工作
  - 如有问题请询问用户

- [-] 5. Interface 模块实现
  - [x] 5.1 创建 Interface Controller
    - 实现 GET /api/interfaces 获取所有接口
    - 实现 GET /api/interfaces/:id 获取单个接口
    - 实现 PATCH /api/interfaces/:id 更新接口
    - 实现 POST /api/interfaces/:id/enable 启用接口
    - 实现 POST /api/interfaces/:id/disable 禁用接口
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 5.2 编写启用/禁用状态切换属性测试
    - **Property 6: 启用/禁用状态切换一致性**
    - **Validates: Requirements 2.5, 4.6**

- [x] 6. IP 模块实现
  - [x] 6.1 创建 IP Address Controller
    - 实现 GET /api/ip/addresses 获取所有 IP 地址
    - 实现 POST /api/ip/addresses 添加 IP 地址
    - 实现 PATCH /api/ip/addresses/:id 更新 IP 地址
    - 实现 DELETE /api/ip/addresses/:id 删除 IP 地址
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.2 创建 Route Controller
    - 实现 GET /api/ip/routes 获取所有路由
    - 实现 POST /api/ip/routes 添加路由
    - 实现 PATCH /api/ip/routes/:id 更新路由
    - 实现 DELETE /api/ip/routes/:id 删除路由
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.11_

- [x] 7. System 模块实现
  - [x] 7.1 创建 Scheduler Controller
    - 实现 GET /api/system/scheduler 获取所有计划任务
    - 实现 POST /api/system/scheduler 添加计划任务
    - 实现 PATCH /api/system/scheduler/:id 更新计划任务
    - 实现 DELETE /api/system/scheduler/:id 删除计划任务
    - 实现启用/禁用端点
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 7.2 创建 Script Controller
    - 实现 GET /api/system/scripts 获取所有脚本
    - 实现 POST /api/system/scripts 添加脚本
    - 实现 PATCH /api/system/scripts/:id 更新脚本
    - 实现 DELETE /api/system/scripts/:id 删除脚本
    - 实现 POST /api/system/scripts/:id/run 运行脚本
    - _Requirements: 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

  - [ ]* 7.3 编写 Scheduler 时间间隔格式验证属性测试
    - **Property 7: Scheduler 时间间隔格式验证**
    - **Validates: Requirements 4.3**

- [x] 8. Checkpoint - 后端 API 完成
  - 确保所有 API 端点正常工作
  - 确保错误处理正确
  - 如有问题请询问用户

- [x] 9. 前端基础架构
  - [x] 9.1 创建主布局组件
    - 创建 AppLayout.vue 主布局
    - 创建 SideMenu.vue 侧边导航菜单
    - 创建 ConnectionStatus.vue 连接状态指示器
    - 配置 Element Plus 主题
    - _Requirements: 6.2, 6.6_

  - [x] 9.2 配置路由和状态管理
    - 配置 Vue Router 路由表
    - 创建 Pinia connection store
    - 创建 API 请求封装模块
    - _Requirements: 6.1_

- [x] 10. 前端连接配置页面
  - [x] 10.1 创建 ConnectionView.vue
    - 实现连接配置表单（地址、端口、用户名、密码、TLS）
    - 实现连接测试和保存功能
    - 实现连接状态显示
    - 实现错误提示
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 11. 前端 Interface 模块
  - [x] 11.1 创建 InterfaceView.vue
    - 实现接口列表表格（名称、类型、MAC、状态、备注）
    - 实现接口详情对话框
    - 实现接口编辑对话框
    - 实现启用/禁用按钮
    - 实现加载状态和错误提示
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 12. 前端 IP 模块
  - [x] 12.1 创建 IpAddressView.vue
    - 实现 IP 地址列表表格
    - 实现添加/编辑 IP 地址对话框
    - 实现删除确认
    - 实现表单验证
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.10_

  - [x] 12.2 创建 IpRouteView.vue
    - 实现路由列表表格
    - 实现添加/编辑路由对话框
    - 实现删除确认
    - 实现表单验证
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 3.10, 3.11_

- [x] 13. 前端 System 模块
  - [x] 13.1 创建 SchedulerView.vue
    - 实现计划任务列表表格
    - 实现添加/编辑计划任务对话框
    - 实现启用/禁用按钮
    - 实现删除确认
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 13.2 创建 ScriptView.vue
    - 实现脚本列表表格
    - 实现添加/编辑脚本对话框（含代码编辑器）
    - 实现运行脚本按钮
    - 实现删除确认
    - _Requirements: 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

- [x] 14. Checkpoint - 前端功能完成
  - 确保所有页面正常工作
  - 确保与后端 API 正确交互
  - 如有问题请询问用户

- [x] 15. Docker 部署配置
  - [x] 15.1 创建 Docker 配置文件
    - 创建 Dockerfile（多阶段构建）
    - 创建 docker-compose.yml
    - 创建 nginx.conf 配置反向代理
    - 创建 .dockerignore
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 15.2 编写数据模型字段完整性属性测试
    - **Property 5: 数据模型字段完整性**
    - **Validates: Requirements 2.2, 3.2, 3.6, 4.2, 4.7**

  - [ ]* 15.3 编写 API 错误响应属性测试
    - **Property 4: API 响应错误信息完整性**
    - **Validates: Requirements 1.3, 2.6, 3.11, 4.12, 6.5**

- [x] 16. Final Checkpoint - 项目完成
  - 确保 Docker 构建成功
  - 确保所有功能正常
  - 确保所有测试通过
  - 如有问题请询问用户

## Notes

- 标记 `*` 的任务为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号以便追溯
- Checkpoint 任务用于阶段性验证
- 属性测试验证通用正确性属性
