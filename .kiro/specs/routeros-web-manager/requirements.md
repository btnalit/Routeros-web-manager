# Requirements Document

## Introduction

RouterOS Web Manager 是一个轻量级的 Web 管理界面，通过 RouterOS API 实现对 MikroTik 路由器的远程管理。系统支持 Docker 部署，专注于三个核心模块的管理：Interface（接口）、IP（网络地址）和 System（系统）。

## Glossary

- **RouterOS_API**: MikroTik RouterOS 提供的 REST API 接口，用于远程管理路由器
- **Web_Manager**: 本系统的 Web 管理界面
- **Interface_Module**: RouterOS 的网络接口管理模块，包含以太网口、VLAN、桥接等
- **IP_Module**: RouterOS 的 IP 地址和路由管理模块，包含地址分配和路由表配置
- **System_Module**: RouterOS 的系统管理模块，包含计划任务（Scheduler）和脚本（Script）
- **Scheduler**: RouterOS 的计划任务功能，用于定时执行脚本
- **Script**: RouterOS 的脚本功能，用于存储和执行自动化命令
- **Route**: RouterOS 的路由配置，定义数据包的转发路径
- **Docker_Container**: 用于部署本系统的容器化环境
- **Vue_3**: 前端 JavaScript 框架，用于构建用户界面
- **Element_Plus**: 基于 Vue 3 的 UI 组件库

## Requirements

### Requirement 1: RouterOS 连接管理

**User Story:** 作为管理员，我希望能够配置和管理 RouterOS 设备的连接信息，以便系统能够与路由器通信。

#### Acceptance Criteria

1. WHEN 管理员首次访问系统 THEN Web_Manager SHALL 显示 RouterOS 连接配置界面
2. WHEN 管理员输入 RouterOS 地址、端口、用户名和密码 THEN Web_Manager SHALL 验证连接并保存配置
3. WHEN 连接验证失败 THEN Web_Manager SHALL 显示具体的错误信息
4. WHEN 连接配置成功保存 THEN Web_Manager SHALL 跳转到主管理界面
5. IF RouterOS 连接断开 THEN Web_Manager SHALL 显示连接状态警告并提供重连选项

### Requirement 2: Interface 模块管理

**User Story:** 作为管理员，我希望能够查看和管理 RouterOS 的网络接口，以便配置网络连接。

#### Acceptance Criteria

1. WHEN 管理员访问 Interface 模块 THEN Web_Manager SHALL 显示所有网络接口列表
2. WHEN 显示接口列表 THEN Web_Manager SHALL 展示接口名称、类型、MAC地址、状态和备注信息
3. WHEN 管理员点击某个接口 THEN Web_Manager SHALL 显示该接口的详细配置信息
4. WHEN 管理员修改接口配置并提交 THEN Web_Manager SHALL 通过 RouterOS_API 更新配置
5. WHEN 管理员启用或禁用接口 THEN Web_Manager SHALL 立即更新接口状态
6. IF 接口配置更新失败 THEN Web_Manager SHALL 显示错误信息并保持原有配置

### Requirement 3: IP 模块管理

**User Story:** 作为管理员，我希望能够管理 RouterOS 的 IP 地址和路由配置，以便设置网络寻址和路由策略。

#### Acceptance Criteria

1. WHEN 管理员访问 IP 模块 THEN Web_Manager SHALL 显示 IP 地址列表和路由列表的切换视图
2. WHEN 显示 IP 地址列表 THEN Web_Manager SHALL 展示地址、接口、网络和状态信息
3. WHEN 管理员添加新 IP 地址 THEN Web_Manager SHALL 验证地址格式并通过 RouterOS_API 创建
4. WHEN 管理员修改 IP 地址配置 THEN Web_Manager SHALL 通过 RouterOS_API 更新配置
5. WHEN 管理员删除 IP 地址 THEN Web_Manager SHALL 确认后通过 RouterOS_API 删除
6. WHEN 显示路由列表 THEN Web_Manager SHALL 展示目标地址、网关、接口、距离和状态信息
7. WHEN 管理员添加新路由 THEN Web_Manager SHALL 验证路由参数并通过 RouterOS_API 创建
8. WHEN 管理员修改路由配置 THEN Web_Manager SHALL 通过 RouterOS_API 更新配置
9. WHEN 管理员删除路由 THEN Web_Manager SHALL 确认后通过 RouterOS_API 删除
10. IF IP 地址或路由格式无效 THEN Web_Manager SHALL 显示格式错误提示
11. IF IP 操作失败 THEN Web_Manager SHALL 显示 RouterOS 返回的错误信息

### Requirement 4: System 模块管理

**User Story:** 作为管理员，我希望能够管理 RouterOS 的计划任务和脚本，以便实现自动化运维。

#### Acceptance Criteria

1. WHEN 管理员访问 System 模块 THEN Web_Manager SHALL 显示 Scheduler 和 Script 的切换视图
2. WHEN 显示 Scheduler 列表 THEN Web_Manager SHALL 展示任务名称、执行间隔、下次运行时间、状态和关联脚本
3. WHEN 管理员添加新 Scheduler THEN Web_Manager SHALL 验证参数并通过 RouterOS_API 创建
4. WHEN 管理员修改 Scheduler 配置 THEN Web_Manager SHALL 通过 RouterOS_API 更新配置
5. WHEN 管理员删除 Scheduler THEN Web_Manager SHALL 确认后通过 RouterOS_API 删除
6. WHEN 管理员启用或禁用 Scheduler THEN Web_Manager SHALL 立即更新任务状态
7. WHEN 显示 Script 列表 THEN Web_Manager SHALL 展示脚本名称、所有者、最后运行时间和运行次数
8. WHEN 管理员添加新 Script THEN Web_Manager SHALL 提供代码编辑器并通过 RouterOS_API 创建
9. WHEN 管理员修改 Script 内容 THEN Web_Manager SHALL 通过 RouterOS_API 更新脚本
10. WHEN 管理员删除 Script THEN Web_Manager SHALL 确认后通过 RouterOS_API 删除
11. WHEN 管理员手动运行 Script THEN Web_Manager SHALL 通过 RouterOS_API 执行脚本
12. IF Scheduler 或 Script 操作失败 THEN Web_Manager SHALL 显示 RouterOS 返回的错误信息

### Requirement 5: Docker 部署支持

**User Story:** 作为运维人员，我希望能够通过 Docker 快速部署系统，以便简化安装和维护。

#### Acceptance Criteria

1. THE Web_Manager SHALL 提供 Dockerfile 用于构建容器镜像
2. THE Web_Manager SHALL 提供 docker-compose.yml 用于一键部署
3. WHEN 容器启动 THEN Web_Manager SHALL 在指定端口提供 Web 服务
4. THE Web_Manager SHALL 支持通过环境变量配置端口和其他参数
5. WHEN 容器重启 THEN Web_Manager SHALL 保持之前的连接配置

### Requirement 6: 用户界面体验

**User Story:** 作为管理员，我希望界面简洁易用，以便高效完成管理任务。

#### Acceptance Criteria

1. THE Web_Manager SHALL 基于 Vue 3 和 Element Plus 框架开发前端界面
2. THE Web_Manager SHALL 提供响应式布局，支持桌面和移动设备访问
3. WHEN 执行操作 THEN Web_Manager SHALL 显示加载状态指示
4. WHEN 操作成功 THEN Web_Manager SHALL 显示成功提示
5. WHEN 操作失败 THEN Web_Manager SHALL 显示清晰的错误信息
6. THE Web_Manager SHALL 提供侧边导航菜单快速切换各模块
7. THE Web_Manager SHALL 使用表格组件展示列表数据，支持排序和筛选
8. THE Web_Manager SHALL 使用对话框组件进行配置编辑
