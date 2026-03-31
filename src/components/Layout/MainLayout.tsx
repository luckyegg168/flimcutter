import React from 'react';
import { Layout, Tooltip } from 'antd';
import {
  DownloadOutlined,
  ScissorOutlined,
  SettingOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageKey } from '../../App';

const { Sider, Content } = Layout;

interface MainLayoutProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

interface NavItem {
  key: PageKey;
  icon: React.ReactNode;
  label: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({ activePage, onNavigate, children }) => {
  const { t } = useTranslation();

  const navItems: NavItem[] = [
    { key: 'download', icon: <DownloadOutlined />, label: t('nav.download') },
    { key: 'editor', icon: <ScissorOutlined />, label: t('nav.editor') },
    { key: 'settings', icon: <SettingOutlined />, label: t('nav.settings') },
  ];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Title bar */}
      <div
        data-tauri-drag-region
        style={{
          height: 32,
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 14,
          gap: 8,
          borderBottom: '1px solid #222',
          flexShrink: 0,
        }}
      >
        <VideoCameraOutlined style={{ color: '#1677ff', fontSize: 14 }} />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>FlimCutter</span>
      </div>

      <Layout style={{ flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sider
          width={64}
          style={{
            background: '#1a1a1a',
            borderRight: '1px solid #222',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 6px',
            }}
          >
            {navItems.map((item) => (
              <Tooltip key={item.key} title={item.label} placement="right">
                <div
                  className={`sidebar-nav-item ${activePage === item.key ? 'active' : ''}`}
                  onClick={() => onNavigate(item.key)}
                >
                  {item.icon}
                  <span style={{ fontSize: 10 }}>{item.label}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        </Sider>

        {/* Main content */}
        <Content
          style={{
            flex: 1,
            overflow: 'hidden',
            background: '#141414',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
