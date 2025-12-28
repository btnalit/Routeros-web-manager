import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import {
  GlobalOutlined,
  CloudServerOutlined,
  NodeIndexOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  return (
    <div>
      <Title level={2}>系统概览</Title>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="VPN接口"
              value={0}
              prefix={<GlobalOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Mihomo容器"
              value={0}
              prefix={<CloudServerOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="代理节点"
              value={0}
              prefix={<NodeIndexOutlined />}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="流量规则"
              value={0}
              prefix={<ShareAltOutlined />}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;