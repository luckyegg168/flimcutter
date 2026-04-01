import React, { useState } from 'react';
import { Button, Slider, Switch, InputNumber, App, Typography, Space, Row, Col, ColorPicker, Divider, Input, Radio } from 'antd';
import { BorderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { addBorder, addImageBorder } from '../../services/ffmpeg';
import EffectPreview from './EffectPreview';

const { Text } = Typography;

const BorderPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);

  const [borderMode, setBorderMode] = useState<'color' | 'image'>('color');
  const [borderWidth, setBorderWidth] = useState(20);
  const [useCustom, setUseCustom] = useState(false);
  const [top, setTop] = useState(20);
  const [bottom, setBottom] = useState(20);
  const [left, setLeft] = useState(20);
  const [right, setRight] = useState(20);
  const [color, setColor] = useState('#000000');
  const [framePath, setFramePath] = useState('');
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

  const handleSelectFrame = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: '圖片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (selected && typeof selected === 'string') setFramePath(selected);
  };

  const handleApply = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, '_border.mp4'),
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'mov'] }],
    });
    if (!outputPath) return;

    setLoading(true);
    setProgress(null);
    try {
      if (borderMode === 'image') {
        if (!framePath) { message.error('請先選擇邊框圖片'); setLoading(false); return; }
        await addImageBorder(
          currentFile.path, outputPath,
          { frame: framePath },
          (p) => setProgress(`${p.toFixed(0)}%`)
        );
      } else {
        const { t, b, l, r } = getEdges();
        await addBorder(
          currentFile.path, outputPath,
          { top: t, bottom: b, left: l, right: r, color },
          (p) => setProgress(`${p.toFixed(0)}%`)
        );
      }
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
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>邊框模式</Text>
          <Radio.Group
            size="small"
            value={borderMode}
            onChange={(e) => setBorderMode(e.target.value)}
            style={{ width: '100%' }}
          >
            <Radio.Button value="color" style={{ width: '50%', textAlign: 'center' }}>純色邊框</Radio.Button>
            <Radio.Button value="image" style={{ width: '50%', textAlign: 'center' }}>圖片邊框</Radio.Button>
          </Radio.Group>
        </div>

        {borderMode === 'color' ? (
          <>
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
          </>
        ) : (
          <div>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
              邊框圖片（PNG 透明中心，邊緣為框）
            </Text>
            <div style={{ display: 'flex', gap: 4 }}>
              <Input
                value={framePath}
                readOnly
                placeholder="選擇邊框圖片..."
                size="small"
                style={{ flex: 1 }}
              />
              <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectFrame}>選擇</Button>
            </div>
          </div>
        )}

        <Divider style={{ margin: '4px 0', borderColor: '#222' }} />
        {borderMode === 'color' && <EffectPreview buildVfFilter={buildVfFilter} />}

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
