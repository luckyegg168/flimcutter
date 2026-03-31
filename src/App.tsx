import React, { useState, useCallback } from 'react';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { useSettingsStore } from './stores/settingsStore';
import MainLayout from './components/Layout/MainLayout';
import DownloadPage from './components/Download/DownloadPage';
import EditorPage from './components/Editor/EditorPage';
import SettingsPage from './components/Settings/SettingsPage';
import './i18n';

export type PageKey = 'download' | 'editor' | 'settings';

const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageKey>('editor');
  const themeMode = useSettingsStore((s) => s.theme);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleNavigate = useCallback((page: PageKey) => {
    setActivePage(page);
  }, []);

  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          colorBgBase: isDark ? '#141414' : '#f5f5f5',
          colorTextBase: isDark ? '#ffffff' : '#000000',
          fontFamily: `-apple-system, 'Microsoft YaHei', BlinkMacSystemFont, 'Segoe UI', sans-serif`,
          fontSize: 13,
        },
        components: {
          Layout: {
            siderBg: isDark ? '#1a1a1a' : '#fff',
            bodyBg: isDark ? '#141414' : '#f0f2f5',
            headerBg: isDark ? '#1a1a1a' : '#fff',
          },
          Menu: {
            darkItemBg: '#1a1a1a',
            darkSubMenuItemBg: '#1f1f1f',
          },
        },
      }}
    >
      <AntApp>
        <MainLayout activePage={activePage} onNavigate={handleNavigate}>
          {activePage === 'download' && <DownloadPage />}
          {activePage === 'editor' && <EditorPage />}
          {activePage === 'settings' && <SettingsPage />}
        </MainLayout>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
