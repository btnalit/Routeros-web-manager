/**
 * IPv6 Firewall Controller
 * 处理 RouterOS IPv6 防火墙 Filter 规则管理相关的 API 请求
 */

import { Request, Response } from 'express';
import { routerosClient } from '../services/routerosClient';
import { IPv6FilterRule } from '../types';
import { logger } from '../utils/logger';

// RouterOS API 路径常量
const IPV6_FIREWALL_FILTER_PATH = '/ipv6/firewall/filter';

// ==================== IPv6 Firewall Filter 相关 ====================

/**
 * 获取所有 IPv6 Filter 规则
 * GET /api/ipv6/firewall/filter
 */
export async function getAllIPv6FilterRules(_req: Request, res: Response): Promise<void> {
  try {
    const rules = await routerosClient.print<IPv6FilterRule>(IPV6_FIREWALL_FILTER_PATH);
    const data = Array.isArray(rules) ? rules : [];

    logger.info(`Returning ${data.length} IPv6 filter rules`);

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    logger.error('Failed to get IPv6 filter rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 Filter 规则列表失败',
    });
  }
}

/**
 * 获取单条 IPv6 Filter 规则
 * GET /api/ipv6/firewall/filter/:id
 */
export async function getIPv6FilterRuleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    const rule = await routerosClient.getById<IPv6FilterRule>(IPV6_FIREWALL_FILTER_PATH, id);

    if (!rule) {
      res.status(404).json({
        success: false,
        error: 'IPv6 Filter 规则不存在',
      });
      return;
    }

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    logger.error('Failed to get IPv6 filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取 IPv6 Filter 规则详情失败',
    });
  }
}


/**
 * 创建 IPv6 Filter 规则
 * POST /api/ipv6/firewall/filter
 */
export async function createIPv6FilterRule(req: Request, res: Response): Promise<void> {
  try {
    const data = req.body;

    if (!data || !data.chain) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：chain',
      });
      return;
    }

    if (!data.action) {
      res.status(400).json({
        success: false,
        error: '缺少必要参数：action',
      });
      return;
    }

    // 验证 chain 值
    const validChains = ['input', 'forward', 'output'];
    if (!validChains.includes(data.chain.toLowerCase())) {
      res.status(400).json({
        success: false,
        error: 'chain 参数无效，必须是 input、forward 或 output',
      });
      return;
    }

    // 验证 action 值
    const validActions = ['accept', 'drop', 'reject', 'jump', 'return', 'log', 'passthrough'];
    if (!validActions.includes(data.action.toLowerCase())) {
      res.status(400).json({
        success: false,
        error: 'action 参数无效，必须是 accept、drop、reject、jump、return、log 或 passthrough',
      });
      return;
    }

    const newRule = await routerosClient.add<IPv6FilterRule>(IPV6_FIREWALL_FILTER_PATH, data);

    logger.info(`Created IPv6 filter rule: chain=${data.chain}, action=${data.action}`);

    res.status(201).json({
      success: true,
      data: newRule,
      message: 'IPv6 Filter 规则已创建',
    });
  } catch (error) {
    logger.error('Failed to create IPv6 filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建 IPv6 Filter 规则失败',
    });
  }
}

/**
 * 更新 IPv6 Filter 规则
 * PATCH /api/ipv6/firewall/filter/:id
 */
export async function updateIPv6FilterRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        error: '缺少更新数据',
      });
      return;
    }

    // 如果更新 chain，验证值
    if (updateData.chain) {
      const validChains = ['input', 'forward', 'output'];
      if (!validChains.includes(updateData.chain.toLowerCase())) {
        res.status(400).json({
          success: false,
          error: 'chain 参数无效，必须是 input、forward 或 output',
        });
        return;
      }
    }

    // 如果更新 action，验证值
    if (updateData.action) {
      const validActions = ['accept', 'drop', 'reject', 'jump', 'return', 'log', 'passthrough'];
      if (!validActions.includes(updateData.action.toLowerCase())) {
        res.status(400).json({
          success: false,
          error: 'action 参数无效，必须是 accept、drop、reject、jump、return、log 或 passthrough',
        });
        return;
      }
    }

    const updatedRule = await routerosClient.set<IPv6FilterRule>(
      IPV6_FIREWALL_FILTER_PATH,
      id,
      updateData
    );

    logger.info(`Updated IPv6 filter rule: ${id}`);

    res.json({
      success: true,
      data: updatedRule,
      message: 'IPv6 Filter 规则已更新',
    });
  } catch (error) {
    logger.error('Failed to update IPv6 filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新 IPv6 Filter 规则失败',
    });
  }
}


/**
 * 删除 IPv6 Filter 规则
 * DELETE /api/ipv6/firewall/filter/:id
 */
export async function deleteIPv6FilterRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    await routerosClient.remove(IPV6_FIREWALL_FILTER_PATH, id);

    logger.info(`Deleted IPv6 filter rule: ${id}`);

    res.json({
      success: true,
      message: 'IPv6 Filter 规则已删除',
    });
  } catch (error) {
    logger.error('Failed to delete IPv6 filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除 IPv6 Filter 规则失败',
    });
  }
}

/**
 * 启用 IPv6 Filter 规则
 * POST /api/ipv6/firewall/filter/:id/enable
 */
export async function enableIPv6FilterRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    await routerosClient.enable(IPV6_FIREWALL_FILTER_PATH, id);
    const updatedRule = await routerosClient.getById<IPv6FilterRule>(IPV6_FIREWALL_FILTER_PATH, id);

    logger.info(`Enabled IPv6 filter rule: ${id}`);

    res.json({
      success: true,
      data: updatedRule,
      message: 'IPv6 Filter 规则已启用',
    });
  } catch (error) {
    logger.error('Failed to enable IPv6 filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '启用 IPv6 Filter 规则失败',
    });
  }
}

/**
 * 禁用 IPv6 Filter 规则
 * POST /api/ipv6/firewall/filter/:id/disable
 */
export async function disableIPv6FilterRule(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: '缺少规则 ID',
      });
      return;
    }

    await routerosClient.disable(IPV6_FIREWALL_FILTER_PATH, id);
    const updatedRule = await routerosClient.getById<IPv6FilterRule>(IPV6_FIREWALL_FILTER_PATH, id);

    logger.info(`Disabled IPv6 filter rule: ${id}`);

    res.json({
      success: true,
      data: updatedRule,
      message: 'IPv6 Filter 规则已禁用',
    });
  } catch (error) {
    logger.error('Failed to disable IPv6 filter rule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '禁用 IPv6 Filter 规则失败',
    });
  }
}
