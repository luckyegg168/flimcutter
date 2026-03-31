import React, { useState } from 'react';
import { Button, Slider, App, Typography, Space, Tag } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import { useVideoStore } from '../../stores/videoStore';
import { detectScenes, formatTime } from '../../services/ffmpeg';

const { Text } = Typography;

const SceneDetectPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [threshold, setThreshold] = useState(0.4);
  const [scenes, setScenes] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const handleDetect = async () => {
    if (!currentFile) return;
    setLoading(true);
    setScenes([]);
    try {
      const result = await detectScenes(currentFile.path, threshold);
      setScenes(result);
      message.success(`偵測到 ${result.length} 個場景切換點`);
    } catch (err) {
      message.error('偵測失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><BuildOutlined /> 場景偵測</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <Text style={{ color: '#888', fontSize: 12 }}>靈敏度閾值: {threshold}</Text>
          <Slider min={0.1} max={0.9} step={0.05} value={threshold} onChange={setThreshold} />
          <Text style={{ color: '#555', fontSize: 10 }}>數值越小，偵測越靈敏 (場景越多)</Text>
        </div>
        <Button type="primary" block icon={<BuildOutlined />} loading={loading} onClick={handleDetect} disabled={!currentFile}>
          偵測場景
        </Button>
        {scenes.length > 0 && (
          <div>
            <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>
              偵測到 {scenes.length} 個場景切換:
            </Text>
            <div style={{ maxHeight: 150, overflow: 'auto' }}>
              {scenes.map((t, i) => (
                <Tag key={i} color="blue" style={{ marginBottom: 2, fontSize: 10 }}>
                  {formatTime(t)}
                </Tag>
              ))}
            </div>
          </div>
        )}
      </Space>
    </div>
  );
};

export default SceneDetectPanel;
