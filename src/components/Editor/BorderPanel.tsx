import React, { useState } from 'react';
import { Button, Slider, Switch, InputNumber, App, Typography, Space, Row, Col, ColorPicker, Divider } from 'antd';
import { BorderOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { addBorder } from '../../services/ffmpeg';
import EffectPreview from './EffectPreview';

const { Text } = Typography;

const BorderPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);

  const [borderWidth, setBorderWidth] = useState(20);
  const [useCustom, setUseCustom] = useState(false);
  const [top, setTop] = useState(20);
  const [bottom, setBottom] = useState(20);
  const [left, setLeft] = useState(20);
  const [right, setRight] = useState(20);
  const [color, setColor] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const getEdges = () => useCustom
    ? { t: top, b: bottom, l: left, r: right }
    : { t: borderWidth, b: borderWidth, l: borderWidth, r: borderWidth };

  const buildVfFilter = (): string | null => {
    const { t, b, l, r } = getEdges();
    const hex = color.replace('#', '');
    return `pad=iw+${l + r}:ih+${t + b}:${l}:${t}:0x${hex}`;
  };

  const handleApply = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, '_border.mp4'),
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'mov'] }],
    });
    if (!outputPath) return;

    const { t, b, l, r } = getEdges();
    setLoading(true);
    setProgress(null);
    try {
      await addBorder(
        currentFile.path, outputPath,
        { top: t, bottom: b, left: l, right: r, color },
        (p) => setProgress(`${p.toFixed(0)}%`)
      );
      message.success('邊框加入完成！');
    } catch (err) {
      message.error('加入邊框失敗: ' + String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <BorderOutlined /> 影片邊框
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>邊框顏色</Text>
          <ColorPicker value={color} onChange={(c) => setColor(c.toHexString())} showText size="small" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#888', fontSize: 12 }}>自訂四邊</Text>
          <Switch size="small" checked={useCustom} onChange={setUseCustom} />
        </div>

        {!useCustom ? (
          <div>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
              邊框寬度: {borderWidth}px
            </Text>
            <Slider min={0} max={200} value={borderWidth} onChange={setBorderWidth} />
          </div>
        ) : (
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 2 }}>上</Text>
              <InputNumber min={0} max={500} value={top} onChange={(v) => setTop(v ?? 0)} size="small" style={{ width: '100%' }} addonAfter="px" />
            </Col>
            <Col span={12}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 2 }}>下</Text>
              <InputNumber min={0} max={500} value={bottom} onChange={(v) => setBottom(v ?? 0)} size="small" style={{ width: '100%' }} addonAfter="px" />
            </Col>
            <Col span={12}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 2 }}>左</Text>
              <InputNumber min={0} max={500} value={left} onChange={(v) => setLeft(v ?? 0)} size="small" style={{ width: '100%' }} addonAfter="px" />
            </Col>
            <Col span={12}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block', marginBottom: 2 }}>右</Text>
              <InputNumber min={0} max={500} value={right} onChange={(v) => setRight(v ?? 0)} size="small" style={{ width: '100%' }} addonAfter="px" />
            </Col>
          </Row>
        )}

        <Divider style={{ margin: '4px 0', borderColor: '#222' }} />
        <EffectPreview buildVfFilter={buildVfFilter} />

        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button
          type="primary"
          block
          icon={<BorderOutlined />}
          loading={loading}
          onClick={handleApply}
          disabled={!currentFile}
        >
          套用邊框
        </Button>
      </Space>
    </div>
  );
};

export default BorderPanel;
