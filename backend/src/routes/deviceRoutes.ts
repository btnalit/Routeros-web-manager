import { Router, Request, Response } from 'express';
import { deviceService } from '../services/deviceService';
import { connectionPool } from '../services/connectionPool';
import { logger } from '../utils/logger';

const router = Router();

// 获取所有设备列表
router.get('/', async (_req: Request, res: Response) => {
  try {
    const devices = await deviceService.getAllDevices();
    res.json(devices);
  } catch (error: any) {
    logger.error('Failed to get devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取单个设备详情
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    const { password, ...safeDevice } = device;
    res.json(safeDevice);
  } catch (error: any) {
    logger.error('Failed to get device:', error);
    res.status(500).json({ error: error.message });
  }
});

// 添加设备
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, host, port, username, password, useTLS } = req.body;

    if (!host || !username || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const device = await deviceService.addDevice({
      name: name || host,
      host,
      port: port || (useTLS ? 8729 : 8728),
      username,
      password,
      useTLS: !!useTLS
    });

    const { password: _, ...safeDevice } = device;
    res.status(201).json(safeDevice);
  } catch (error: any) {
    logger.error('Failed to add device:', error);
    res.status(500).json({ error: error.message });
  }
});

// 更新设备
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, host, port, username, password, useTLS } = req.body;

    const updated = await deviceService.updateDevice(req.params.id, {
      name, host, port, username, password, useTLS
    });

    if (!updated) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const { password: _, ...safeDevice } = updated;
    res.json(safeDevice);
  } catch (error: any) {
    logger.error('Failed to update device:', error);
    res.status(500).json({ error: error.message });
  }
});

// 删除设备
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await deviceService.deleteDevice(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // 同时断开连接
    await connectionPool.disconnect(req.params.id);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete device:', error);
    res.status(500).json({ error: error.message });
  }
});

// 测试设备连接
router.post('/:id/connect', async (req: Request, res: Response) => {
  try {
    const client = await connectionPool.getClient(req.params.id);
    const connected = client.isConnected();
    res.json({ connected });
  } catch (error: any) {
    logger.error('Connection test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 断开设备连接
router.post('/:id/disconnect', async (req: Request, res: Response) => {
  try {
    await connectionPool.disconnect(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Disconnect failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export const deviceRoutes = router;
