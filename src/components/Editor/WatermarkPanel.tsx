import React, { useState } from 'react';
import { Button, Input, Select, Slider, App, Typography, Space, ColorPicker, Col, Row } from 'antd';
import { FontSizeOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { watermarkVideo } from '../../services/ffmpeg';

const { Text } = Typography;

type Position = 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'topleft',     label: '左上' },
  { value: 'topright',    label: '右上' },
  { value: 'bottomleft',  label: '左下' },
  { value: 'bottomright', label: '右下' },
  { value: 'center',      label: '置中' },
];

const WatermarkPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);

  const [text, setText] = useState('FlimCutter');
  const [position, setPosition] = useState<Position>('bottomright');
  const [fontSize, setFontSize] = useState(32);
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleApply = async () => {
    if (!currentFile || !text.trim()) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, '_watermark.mp4'),
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'mov'] }],
    });
    if (!outputPath) return;

    setLoading(true);
    setProgress(null);
    try {
      await watermarkVideo(
        currentFile.path,
        outputPath,
        { text: text.trim(), position, fontSize, color, opacity },
        (p) => setProgress(`${p.toFixed(0)}%`)
      );
      message.success('浮水印加入完成！');
    } catch (err) {
      message.error('浮水印失敗: ' + String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <FontSizeOutlined /> 文字浮水印
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>文字內容</Text>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="輸入浮水印文字"
            maxLength={100}
          />
        </div>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>位置</Text>
          <Select
            value={position}
            onChange={(v) => setPosition(v)}
            style={{ width: '100%' }}
            options={POSITIONS}
            size="small"
          />
        </div>

        <Row gutter={8} align="middle">
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>字體大小: {fontSize}px</Text>
            <Slider min={12} max={120} value={fontSize} onChange={setFontSize} />
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>透明度: {Math.round(opacity * 100)}%</Text>
            <Slider min={0} max={100} value={Math.round(opacity * 100)} onChange={(v) => setOpacity(v / 100)} />
          </Col>
        </Row>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>文字顏色</Text>
          <ColorPicker
            value={color}
            onChange={(c) => setColor(c.toHexString())}
            showText
            size="small"
          />
        </div>

        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button
          type="primary"
          block
          icon={<FontSizeOutlined />}
          loading={loading}
          onClick={handleApply}
          disabled={!currentFile || !text.trim()}
        >
          套用浮水印
        </Button>
      </Space>
    </div>
  );
};

export default WatermarkPanel;
