import React from 'react';
import { Layout, Typography, Space, Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const { Header } = Layout;
const { Title } = Typography;

const AppHeader: React.FC = () => {
  return (
    <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Title level={4} style={{ margin: 0, color: '#001529' }}>
        RouterOS Web 管理器
      </Title>
      <Space>
        <Avatar icon={<UserOutlined />} />
      </Space>
    </Header>
  );
};

export default AppHeader;