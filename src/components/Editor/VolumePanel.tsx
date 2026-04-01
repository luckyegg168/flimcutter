import React, { useState } from 'react';
import { Button, Slider, Switch, App, Typography, Space } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { adjustVolume } from '../../services/ffmpeg';

const { Text } = Typography;

const VolumePanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [volume, setVolume] = useState(1.0);
  const [mute, setMute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleApply = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_vol.mp4`),
      filters: [{ name: '影片', extensions: ['mp4'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    setProgress(null);
    try {
      await adjustVolume(currentFile.path, outputPath, mute ? 0 : volume, (p) => setProgress(`${p.toFixed(0)}%`));
      message.success('音量調整完成！');
    } catch (err) {
      message.error('處理失敗: ' + String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><SoundOutlined /> 音量調整</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#888', fontSize: 12 }}>靜音</Text>
          <Switch size="small" checked={mute} onChange={setMute} />
        </div>
        {!mute && (
          <div>
            <Text style={{ color: '#888', fontSize: 12 }}>音量倍率: {volume.toFixed(2)}x</Text>
            <Slider min={0} max={3} step={0.05} value={volume} onChange={setVolume} disabled={mute} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[0.5, 1.0, 1.5, 2.0].map((v) => (
                <Button key={v} size="small" type={volume === v ? 'primary' : 'default'} onClick={() => setVolume(v)} style={{ flex: 1, fontSize: 11 }}>
                  {v}x
                </Button>
              ))}
            </div>
          </div>
        )}
        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button type="primary" block icon={<SoundOutlined />} loading={loading} onClick={handleApply} disabled={!currentFile}>
          套用音量
        </Button>
      </Space>
    </div>
  );
};

export default VolumePanel;
