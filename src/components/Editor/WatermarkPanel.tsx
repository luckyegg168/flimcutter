import React, { useState } from 'react';
import { Button, Input, Select, Slider, App, Typography, Space, ColorPicker, Row, Col, Segmented, InputNumber } from 'antd';
import { FontSizeOutlined, PictureOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { watermarkVideo, imageWatermark } from '../../services/ffmpeg';

const { Text } = Typography;

type Position = 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center';
type Mode = 'text' | 'image';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'topleft',     label: '左上' },
  { value: 'topright',    label: '右上' },
  { value: 'bottomleft',  label: '左下' },
  { value: 'bottomright', label: '右下' },
  { value: 'center',      label: '置中' },
];

const PRESET_FONTS: { value: string; label: string }[] = [
  { value: 'C:/Windows/Fonts/msjh.ttc',    label: '微軟正黑體' },
  { value: 'C:/Windows/Fonts/kaiu.ttf',    label: '標楷體' },
  { value: 'C:/Windows/Fonts/mingliu.ttc', label: '細明體' },
  { value: 'C:/Windows/Fonts/simsun.ttc',  label: '新細明體 (簡)' },
  { value: 'C:/Windows/Fonts/msyh.ttc',    label: '微軟雅黑 (簡)' },
  { value: '__custom__',                   label: '自訂字型檔...' },
];

const WatermarkPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);

  const [mode, setMode] = useState<Mode>('text');

  // Text mode state
  const [text, setText] = useState('FlimCutter');
  const [position, setPosition] = useState<Position>('bottomright');
  const [fontSize, setFontSize] = useState(36);
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(0.85);
  const [selectedFont, setSelectedFont] = useState('C:/Windows/Fonts/msjh.ttc');
  const [customFontPath, setCustomFontPath] = useState('');

  // Image mode state
  const [imagePath, setImagePath] = useState('');
  const [imgPosition, setImgPosition] = useState<Position>('bottomright');
  const [imgOpacity, setImgOpacity] = useState(0.85);
  const [imgScale, setImgScale] = useState(20); // percent

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleSelectFont = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: '字型檔案', extensions: ['ttf', 'otf', 'ttc'] }],
    });
    if (selected && typeof selected === 'string') {
      setCustomFontPath(selected);
      setSelectedFont('__custom__');
    }
  };

  const handleSelectImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: '圖片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (selected && typeof selected === 'string') {
      setImagePath(selected);
    }
  };

  const handleApply = async () => {
    if (!currentFile) return;

    const ext = mode === 'text' ? '_watermark_text.mp4' : '_watermark_img.mp4';
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, ext),
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'mov'] }],
    });
    if (!outputPath) return;

    setLoading(true);
    setProgress(null);
    try {
      if (mode === 'text') {
        const fontPath = selectedFont === '__custom__' ? customFontPath : selectedFont;
        await watermarkVideo(
          currentFile.path, outputPath,
          { text: text.trim(), position, fontSize, color, opacity, fontPath },
          (p) => setProgress(`${p.toFixed(0)}%`)
        );
      } else {
        if (!imagePath) { message.warning('請先選擇圖片'); return; }
        await imageWatermark(
          currentFile.path, outputPath,
          { image: imagePath, position: imgPosition, opacity: imgOpacity, scale: imgScale },
          (p) => setProgress(`${p.toFixed(0)}%`)
        );
      }
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
        <FontSizeOutlined /> 浮水印
      </Text>

      <Segmented
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        options={[
          { value: 'text',  label: '文字', icon: <FontSizeOutlined /> },
          { value: 'image', label: '圖片', icon: <PictureOutlined /> },
        ]}
        style={{ marginBottom: 12, width: '100%' }}
      />

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {mode === 'text' ? (
          <>
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
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>字型</Text>
              <Select
                value={selectedFont}
                onChange={(v) => { setSelectedFont(v); if (v !== '__custom__') setCustomFontPath(''); }}
                style={{ width: '100%' }}
                options={PRESET_FONTS}
                size="small"
              />
              {selectedFont === '__custom__' && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <Input
                    value={customFontPath}
                    readOnly
                    placeholder="選擇字型檔案..."
                    size="small"
                    style={{ flex: 1 }}
                  />
                  <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectFont} />
                </div>
              )}
            </div>

            <div>
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>位置</Text>
              <Select value={position} onChange={setPosition} style={{ width: '100%' }} options={POSITIONS} size="small" />
            </div>

            <Row gutter={8}>
              <Col span={12}>
                <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>字體大小</Text>
                <InputNumber min={12} max={200} value={fontSize} onChange={(v) => setFontSize(v ?? 36)} size="small" style={{ width: '100%' }} addonAfter="px" />
              </Col>
              <Col span={12}>
                <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>透明度 {Math.round(opacity * 100)}%</Text>
                <Slider min={10} max={100} value={Math.round(opacity * 100)} onChange={(v) => setOpacity(v / 100)} />
              </Col>
            </Row>

            <div>
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>文字顏色</Text>
              <ColorPicker value={color} onChange={(c) => setColor(c.toHexString())} showText size="small" />
            </div>
          </>
        ) : (
          <>
            <div>
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>圖片檔案</Text>
              <div style={{ display: 'flex', gap: 4 }}>
                <Input value={imagePath} readOnly placeholder="選擇圖片..." size="small" style={{ flex: 1 }} />
                <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectImage}>選擇</Button>
              </div>
            </div>

            <div>
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>位置</Text>
              <Select value={imgPosition} onChange={setImgPosition} style={{ width: '100%' }} options={POSITIONS} size="small" />
            </div>

            <Row gutter={8}>
              <Col span={12}>
                <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>縮放 {imgScale}%</Text>
                <Slider min={5} max={100} value={imgScale} onChange={setImgScale} />
              </Col>
              <Col span={12}>
                <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>透明度 {Math.round(imgOpacity * 100)}%</Text>
                <Slider min={10} max={100} value={Math.round(imgOpacity * 100)} onChange={(v) => setImgOpacity(v / 100)} />
              </Col>
            </Row>
          </>
        )}

        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button
          type="primary"
          block
          icon={mode === 'text' ? <FontSizeOutlined /> : <PictureOutlined />}
          loading={loading}
          onClick={handleApply}
          disabled={!currentFile || (mode === 'text' && !text.trim()) || (mode === 'image' && !imagePath)}
        >
          套用浮水印
        </Button>
      </Space>
    </div>
  );
};

export default WatermarkPanel;
