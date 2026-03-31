import React, { useState } from 'react';
import { Button, App, Typography, Space } from 'antd';
import { CameraOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { takeScreenshot, formatTime } from '../../services/ffmpeg';

const { Text } = Typography;

const ScreenshotPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const currentTime = useVideoStore((s) => s.currentTime);
  const [loading, setLoading] = useState(false);

  const handleScreenshot = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_${Math.floor(currentTime)}s.png`),
      filters: [{ name: '圖片', extensions: ['png', 'jpg'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    try {
      await takeScreenshot(currentFile.path, outputPath, currentTime);
      message.success('截圖完成！');
    } catch (err) {
      message.error('截圖失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><CameraOutlined /> 截取畫面</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Text style={{ color: '#888', fontSize: 12 }}>目前時間: {formatTime(currentTime)}</Text>
        <Text style={{ color: '#555', fontSize: 11 }}>截圖將擷取播放器目前位置的影格</Text>
        <Button type="primary" block icon={<CameraOutlined />} loading={loading} onClick={handleScreenshot} disabled={!currentFile}>
          截圖
        </Button>
      </Space>
    </div>
  );
};

export default ScreenshotPanel;
