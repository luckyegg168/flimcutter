import React, { useState } from 'react';
import { Button, Slider, Select, InputNumber, App, Typography, Space, Input } from 'antd';
import { PictureOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { floatingImage } from '../../services/ffmpeg';

const { Text } = Typography;

type Motion = 'bounce_h' | 'bounce_v' | 'diagonal' | 'circular';

const MOTION_OPTIONS = [
  { value: 'bounce_h', label: '左右彈跳' },
  { value: 'bounce_v', label: '上下彈跳' },
  { value: 'diagonal', label: '對角線彈跳' },
  { value: 'circular', label: '圓形軌道' },
];

const FloatingImagePanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);

  const [imagePath, setImagePath] = useState('');
  const [motion, setMotion] = useState<Motion>('bounce_h');
  const [speed, setSpeed] = useState(1.0);
  const [scale, setScale] = useState(15);
  const [opacity, setOpacity] = useState(0.9);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const handleSelectImage = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: '圖片', extensions: ['png', 'gif', 'webp', 'jpg', 'jpeg'] }],
    });
    if (selected && typeof selected === 'string') {
      setImagePath(selected);
    }
  };

  const handleApply = async () => {
    if (!currentFile || !imagePath) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, '_floating.mp4'),
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'mov'] }],
    });
    if (!outputPath) return;

    setLoading(true);
    setProgress(null);
    try {
      await floatingImage(
        currentFile.path, outputPath,
        { image: imagePath, motion, speed, scale, opacity, radius },
        (p) => setProgress(`${p.toFixed(0)}%`)
      );
      message.success('浮動圖片套用完成！');
    } catch (err) {
      message.error('套用失敗: ' + String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <PictureOutlined /> 浮動圖片
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>圖片檔案</Text>
          <div style={{ display: 'flex', gap: 4 }}>
            <Input
              value={imagePath}
              readOnly
              placeholder="選擇 PNG / GIF / WebP..."
              size="small"
              style={{ flex: 1 }}
            />
            <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectImage}>選擇</Button>
          </div>
        </div>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>動態模式</Text>
          <Select
            value={motion}
            onChange={(v) => setMotion(v as Motion)}
            options={MOTION_OPTIONS}
            style={{ width: '100%' }}
            size="small"
          />
        </div>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
            速度: {speed.toFixed(1)}x
          </Text>
          <Slider
            min={2}
            max={50}
            value={Math.round(speed * 10)}
            onChange={(v) => setSpeed(v / 10)}
          />
        </div>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
            縮放: {scale}%
          </Text>
          <Slider min={5} max={50} value={scale} onChange={setScale} />
        </div>

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>
            透明度: {Math.round(opacity * 100)}%
          </Text>
          <Slider
            min={10}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(v) => setOpacity(v / 100)}
          />
        </div>

        {motion === 'circular' && (
          <div>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>軌道半徑</Text>
            <InputNumber
              min={20}
              max={800}
              value={radius}
              onChange={(v) => setRadius(v ?? 100)}
              size="small"
              style={{ width: '100%' }}
              addonAfter="px"
            />
          </div>
        )}

        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button
          type="primary"
          block
          icon={<PictureOutlined />}
          loading={loading}
          onClick={handleApply}
          disabled={!currentFile || !imagePath}
        >
          套用浮動圖片
        </Button>
      </Space>
    </div>
  );
};

export default FloatingImagePanel;
