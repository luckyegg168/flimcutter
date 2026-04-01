import React, { useState } from 'react';
import { Button, App, Typography, Space, Tag } from 'antd';
import { ScissorOutlined, StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons';
import { useVideoStore } from '../../stores/videoStore';
import { trimVideo, formatTime } from '../../services/ffmpeg';
import { save } from '@tauri-apps/plugin-dialog';

const { Text } = Typography;

const TrimPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const trimStart = useVideoStore((s) => s.trimStart);
  const trimEnd = useVideoStore((s) => s.trimEnd);
  const currentTime = useVideoStore((s) => s.currentTime);
  const setTrimStart = useVideoStore((s) => s.setTrimStart);
  const setTrimEnd = useVideoStore((s) => s.setTrimEnd);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleTrim = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, '_trimmed.mp4'),
      filters: [{ name: '影片', extensions: ['mp4'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    setProgress(null);
    try {
      await trimVideo(
        currentFile.path,
        outputPath,
        trimStart,
        trimEnd,
        (p: number) => setProgress(String(p.toFixed(0)) + '%'),
      );
      message.success('裁切完成！');
    } catch (err) {
      message.error('裁切失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <ScissorOutlined /> 影片裁切
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button
            size="small"
            icon={<StepBackwardOutlined />}
            onClick={() => setTrimStart(currentTime)}
            title="設為開始點"
          >
            設為開始
          </Button>
          <Tag color="blue" style={{ margin: 0 }}>{formatTime(trimStart)}</Tag>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button
            size="small"
            icon={<StepForwardOutlined />}
            onClick={() => setTrimEnd(currentTime)}
            title="設為結束點"
          >
            設為結束
          </Button>
          <Tag color="blue" style={{ margin: 0 }}>{formatTime(trimEnd)}</Tag>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 12, width: 52 }}>時長</Text>
          <Tag color="green">{formatTime(trimEnd - trimStart)}</Tag>
        </div>
        <Text style={{ color: '#555', fontSize: 11 }}>
          拖曳紅色播放線到目標位置，按「設為開始/結束」定義裁切區間
        </Text>
        {progress && <Text style={{ color: '#aaa', fontSize: 10 }}>{progress}</Text>}
        <Button
          type="primary"
          block
          icon={<ScissorOutlined />}
          loading={loading}
          onClick={handleTrim}
          disabled={!currentFile || trimEnd <= trimStart}
        >
          裁切並儲存
        </Button>
      </Space>
    </div>
  );
};

export default TrimPanel;
