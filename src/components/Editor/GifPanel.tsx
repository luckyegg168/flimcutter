import React, { useState } from 'react';
import { Button, InputNumber, App, Typography, Space, Row, Col } from 'antd';
import { FileGifOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { makeGif, formatTime } from '../../services/ffmpeg';

const { Text } = Typography;

const GifPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const trimStart = useVideoStore((s) => s.trimStart);
  const trimEnd = useVideoStore((s) => s.trimEnd);
  const [fps, setFps] = useState(10);
  const [width, setWidth] = useState(480);
  const [loading, setLoading] = useState(false);

  const duration = trimEnd - trimStart;

  const handleMakeGif = async () => {
    if (!currentFile) return;
    if (duration > 30) { message.warning('GIF 建議不超過 30 秒'); return; }
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, '.gif'),
      filters: [{ name: 'GIF', extensions: ['gif'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    try {
      await makeGif(currentFile.path, outputPath, trimStart, trimEnd, fps, width);
      message.success('GIF 製作完成！');
    } catch (err) {
      message.error('製作失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><FileGifOutlined /> 製作 GIF</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ fontSize: 12, color: '#888' }}>
          區間: {formatTime(trimStart)} – {formatTime(trimEnd)} ({duration.toFixed(1)}s)
        </div>
        <Row gutter={8}>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>FPS</Text>
            <InputNumber min={1} max={30} value={fps} onChange={(v) => setFps(v ?? 10)} style={{ width: '100%' }} size="small" />
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>寬度 (px)</Text>
            <InputNumber min={120} max={1920} step={10} value={width} onChange={(v) => setWidth(v ?? 480)} style={{ width: '100%' }} size="small" />
          </Col>
        </Row>
        {duration > 30 && <Text style={{ color: '#ff4444', fontSize: 11 }}>⚠️ GIF 超過 30 秒可能非常大</Text>}
        <Button type="primary" block icon={<FileGifOutlined />} loading={loading} onClick={handleMakeGif} disabled={!currentFile}>
          製作 GIF
        </Button>
      </Space>
    </div>
  );
};

export default GifPanel;
