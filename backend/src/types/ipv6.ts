/**
 * IPv6 数据类型定义
 * 定义与 RouterOS IPv6 API 交互所需的所有接口类型
 */

// ==================== IPv6 Address ====================

/**
 * IPv6 地址数据模型
 */
export interface IPv6Address {
  '.id': string;              // RouterOS 内部 ID
  address: string;            // IPv6 地址（CIDR 格式）
  'from-pool'?: string;       // 来源池
  interface: string;          // 绑定接口
  eui64?: boolean;            // 使用 EUI-64
  advertise?: boolean;        // 是否通告
  'no-dad'?: boolean;         // 禁用 DAD
  disabled?: boolean;         // 是否禁用
  comment?: string;           // 备注
  dynamic?: boolean;          // 是否动态
  global?: boolean;           // 是否全局
  invalid?: boolean;          // 是否无效
  'link-local'?: boolean;     // 是否链路本地
  actual?: string;            // 实际地址
}

// ==================== DHCPv6 Client ====================

/**
 * DHCPv6 客户端数据模型
 */
export interface DHCPv6Client {
  '.id': string;              // RouterOS 内部 ID
  interface: string;          // 接口
  request?: string;           // 请求类型：info, address, prefix
  'pool-name'?: string;       // 池名称
  'pool-prefix-length'?: number; // 池前缀长度
  'prefix-hint'?: string;     // 前缀提示
  'rapid-commit'?: boolean;   // 快速提交
  'add-default-route'?: boolean; // 添加默认路由
  'allow-reconfigure'?: boolean; // 允许重配置
  'use-peer-dns'?: boolean;   // 使用对端 DNS
  disabled?: boolean;         // 是否禁用
  comment?: string;           // 备注
  status?: string;            // 状态
  address?: string;           // 获取的地址
  prefix?: string;            // 获取的前缀
  'expires-after'?: string;   // 过期时间
  duid?: string;              // DUID
  dynamic?: boolean;          // 是否动态
  invalid?: boolean;          // 是否无效
}

// ==================== ND (Neighbor Discovery) ====================

/**
 * 邻居发现（ND）配置数据模型
 */
export interface ND {
  '.id': string;              // RouterOS 内部 ID
  interface: string;          // 接口
  'ra-interval'?: string;     // RA 间隔（如 "200-600"）
  'ra-delay'?: string;        // RA 延迟
  'ra-preference'?: string;   // RA 优先级：low, medium, high
  mtu?: number;               // MTU
  'reachable-time'?: string;  // 可达时间
  'retransmit-interval'?: string; // 重传间隔
  'ra-lifetime'?: string;     // RA 生命周期
  'hop-limit'?: number;       // 跳数限制
  'dns-servers'?: string;     // DNS 服务器（逗号分隔）
  'pref64-prefixes'?: string; // PREF64 前缀
  'advertise-mac-address'?: boolean; // 通告 MAC 地址
  'advertise-dns'?: boolean;  // 通告 DNS
  'managed-address-configuration'?: boolean; // 托管地址配置
  'other-configuration'?: boolean; // 其他配置
  disabled?: boolean;         // 是否禁用
  comment?: string;           // 备注
  dynamic?: boolean;          // 是否动态
  invalid?: boolean;          // 是否无效
}

// ==================== IPv6 Neighbor ====================

/**
 * IPv6 邻居表数据模型
 */
export interface IPv6Neighbor {
  '.id': string;              // RouterOS 内部 ID
  address: string;            // IPv6 地址
  interface: string;          // 接口
  'mac-address': string;      // MAC 地址
  status: string;             // 状态：noarp, incomplete, reachable, stale, delay, probe
  'bridge-port'?: string;     // Bridge 端口
  'host-name'?: string;       // 主机名
  dynamic?: boolean;          // 是否动态
  comment?: string;           // 备注
}

// ==================== IPv6 Route ====================

/**
 * IPv6 路由数据模型
 */
export interface IPv6Route {
  '.id': string;              // RouterOS 内部 ID
  'dst-address': string;      // 目标地址
  gateway?: string;           // 网关
  'pref-src'?: string;        // 首选源
  'immediate-gw'?: string;    // 即时网关
  'check-gateway'?: string;   // 检查网关
  'suppress-hw-offload'?: boolean; // 抑制硬件卸载
  blackhole?: boolean;        // 黑洞路由
  distance?: number;          // 距离
  scope?: number;             // Scope
  'target-scope'?: number;    // Target Scope
  'vrf-interface'?: string;   // VRF 接口
  'routing-table'?: string;   // 路由表
  mtu?: number;               // MTU
  'hop-limit'?: number;       // 跳数限制
  disabled?: boolean;         // 是否禁用
  comment?: string;           // 备注
  active?: boolean;           // 是否活动
  dynamic?: boolean;          // 是否动态
  static?: boolean;           // 是否静态
  'gateway-status'?: string;  // 网关状态
}

// ==================== IPv6 Firewall Filter ====================

/**
 * IPv6 防火墙 Filter 规则数据模型
 */
export interface IPv6FilterRule {
  '.id': string;              // RouterOS 内部 ID
  chain: string;              // Chain: input, forward, output
  action: string;             // Action: accept, drop, reject, jump, return, log, passthrough
  'src-address'?: string;     // 源地址
  'dst-address'?: string;     // 目标地址
  'src-address-list'?: string; // 源地址列表
  'dst-address-list'?: string; // 目标地址列表
  protocol?: string;          // 协议
  'src-port'?: string;        // 源端口
  'dst-port'?: string;        // 目标端口
  'any-port'?: string;        // 任意端口
  'in-interface'?: string;    // 入接口
  'out-interface'?: string;   // 出接口
  'in-interface-list'?: string; // 入接口列表
  'out-interface-list'?: string; // 出接口列表
  'packet-mark'?: string;     // 数据包标记
  'connection-mark'?: string; // 连接标记
  'routing-mark'?: string;    // 路由标记
  'connection-type'?: string; // 连接类型
  'connection-state'?: string; // 连接状态
  'connection-nat-state'?: string; // 连接 NAT 状态
  'icmp-options'?: string;    // ICMP 选项
  disabled?: boolean;         // 是否禁用
  comment?: string;           // 备注
  dynamic?: boolean;          // 是否动态
  bytes?: number;             // 字节数
  packets?: number;           // 数据包数
  invalid?: boolean;          // 是否无效
  log?: boolean;              // 是否记录日志
  'log-prefix'?: string;      // 日志前缀
}
