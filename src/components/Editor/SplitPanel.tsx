import React, { useState } from 'react';
import { Button, App, Typography, Space, Row, Col } from 'antd';
import { SplitCellsOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useVideoStore } from '../../stores/videoStore';
import { splitVideo, formatTime } from '../../services/ffmpeg';
import { open } from '@tauri-apps/plugin-dialog';

const { Text } = Typography;

const SplitPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const currentTime = useVideoStore((s) => s.currentTime);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const addCurrentTime = () => {
    if (splitPoints.includes(currentTime)) return;
    setSplitPoints((prev) => [...prev, currentTime].sort((a, b) => a - b));
  };

  const removePoint = (t: number) => setSplitPoints((prev) => prev.filter((p) => p !== t));

  const handleSplit = async () => {
    if (!currentFile || splitPoints.length === 0) return;
    const outputDir = await open({ directory: true, title: '選擇輸出資料夾' });
    if (!outputDir || typeof outputDir !== 'string') return;
    setLoading(true);
    try {
      await splitVideo(currentFile.path, splitPoints, outputDir);
      message.success(`分割完成！共 ${splitPoints.length + 1} 段`);
    } catch (err) {
      message.error('分割失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <SplitCellsOutlined /> 影片分割
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        <Button size="small" icon={<PlusOutlined />} onClick={addCurrentTime} disabled={!currentFile}>
          加入目前時間點 ({formatTime(currentTime)})
        </Button>

        {splitPoints.length > 0 && (
          <div>
            <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 4 }}>
              分割點 ({splitPoints.length}個):
            </Text>
            {splitPoints.map((t) => (
              <Row key={t} gutter={4} align="middle" style={{ marginBottom: 2 }}>
                <Col flex={1}>
                  <Text style={{ fontSize: 12, color: '#aaa' }}>{formatTime(t)}</Text>
                </Col>
                <Col>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removePoint(t)} />
                </Col>
              </Row>
            ))}
          </div>
        )}

        <Button
          type="primary"
          block
          icon={<SplitCellsOutlined />}
          loading={loading}
          onClick={handleSplit}
          disabled={!currentFile || splitPoints.length === 0}
        >
          分割 ({splitPoints.length + 1} 段)
        </Button>
      </Space>
    </div>
  );
};

export default SplitPanel;
