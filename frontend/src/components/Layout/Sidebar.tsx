import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  NodeIndexOutlined,
  ShareAltOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/vpn',
      icon: <GlobalOutlined />,
      label: 'VPN接口管理',
    },
    {
      key: '/mihomo',
      icon: <CloudServerOutlined />,
      label: 'Mihomo容器',
    },
    {
      key: '/proxy',
      icon: <NodeIndexOutlined />,
      label: '代理节点',
    },
    {
      key: '/traffic',
      icon: <ShareAltOutlined />,
      label: '流量引流',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Sider collapsible>
      <div className="logo">
        RouterOS
      </div>
      <Menu
        theme="dark"
        selectedKeys={[location.pathname]}
        mode="inline"
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

export default AppSidebar;