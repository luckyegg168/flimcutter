import React, { useState } from 'react';
import { Button, Slider, App, Typography, Space, Tag } from 'antd';
import { FieldTimeOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { adjustSpeed } from '../../services/ffmpeg';

const { Text } = Typography;

const PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const SpeedPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleApply = async () => {
    if (!currentFile || speed === 1) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_${speed}x.mp4`),
      filters: [{ name: '影片', extensions: ['mp4'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    setProgress(null);
    try {
      await adjustSpeed(currentFile.path, outputPath, speed, (p) => setProgress(`${p.toFixed(0)}%`));
      message.success('速度調整完成！');
    } catch (err) {
      message.error('處理失敗: ' + String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><FieldTimeOutlined /> 播放速度</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <Tag key={p} color={speed === p ? 'blue' : 'default'} style={{ cursor: 'pointer', fontSize: 11 }} onClick={() => setSpeed(p)}>
              {p}x
            </Tag>
          ))}
        </div>
        <div>
          <Text style={{ color: '#888', fontSize: 12 }}>自訂倍率: {speed}x</Text>
          <Slider min={0.25} max={4} step={0.05} value={speed} onChange={setSpeed} />
        </div>
        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button type="primary" block icon={<FieldTimeOutlined />} loading={loading} onClick={handleApply} disabled={!currentFile || speed === 1}>
          套用 ({speed}x)
        </Button>
      </Space>
    </div>
  );
};

export default SpeedPanel;
