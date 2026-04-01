import React, { useState } from 'react';
import { Button, InputNumber, App, Typography, Space, Tag, Row, Col, Divider } from 'antd';
import { FullscreenExitOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { cropVideo } from '../../services/ffmpeg';
import EffectPreview from './EffectPreview';

const { Text } = Typography;

const CropPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);

  const srcW = currentFile?.width ?? 1920;
  const srcH = currentFile?.height ?? 1080;

  const [cropW, setCropW] = useState<number>(srcW);
  const [cropH, setCropH] = useState<number>(srcH);
  const [cropX, setCropX] = useState<number>(0);
  const [cropY, setCropY] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Reset when file changes
  React.useEffect(() => {
    if (currentFile) {
      setCropW(currentFile.width ?? 1920);
      setCropH(currentFile.height ?? 1080);
      setCropX(0);
      setCropY(0);
    }
  }, [currentFile]);

  const isValid =
    cropW > 0 && cropH > 0 &&
    cropX >= 0 && cropY >= 0 &&
    cropX + cropW <= srcW &&
    cropY + cropH <= srcH;

  const buildVfFilter = (): string | null => {
    if (!isValid) return null;
    return `crop=${cropW}:${cropH}:${cropX}:${cropY}`;
  };

  const handleApply = async () => {
    if (!currentFile || !isValid) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_crop_${cropW}x${cropH}.mp4`),
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'mov'] }],
    });
    if (!outputPath) return;

    setLoading(true);
    setProgress(null);
    try {
      await cropVideo(
        currentFile.path,
        outputPath,
        { width: cropW, height: cropH, x: cropX, y: cropY },
        (p) => setProgress(`${p.toFixed(0)}%`)
      );
      message.success('裁剪完成！');
    } catch (err) {
      message.error('裁剪失敗: ' + String(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const setPreset = (_label: string, w: number, h: number) => {
    // centre the crop
    const nx = Math.max(0, Math.floor((srcW - w) / 2));
    const ny = Math.max(0, Math.floor((srcH - h) / 2));
    setCropW(Math.min(w, srcW));
    setCropH(Math.min(h, srcH));
    setCropX(nx);
    setCropY(ny);
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <FullscreenExitOutlined /> 影片裁剪
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {currentFile && (
          <Text style={{ color: '#888', fontSize: 11 }}>
            原始尺寸: {srcW} × {srcH}
          </Text>
        )}

        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>快速預設</Text>
          <Space wrap size={4}>
            {[
              { label: '16:9 ↓720p', w: 1280, h: 720 },
              { label: '9:16', w: 720, h: 1280 },
              { label: '1:1', w: Math.min(srcW, srcH), h: Math.min(srcW, srcH) },
              { label: '4:3', w: srcH > 0 ? Math.round(srcH * 4 / 3) : 1440, h: srcH },
            ].map((p) => (
              <Tag
                key={p.label}
                onClick={() => setPreset(p.label, p.w, p.h)}
                style={{ cursor: 'pointer' }}
                color="blue"
              >
                {p.label}
              </Tag>
            ))}
          </Space>
        </div>

        <Row gutter={[8, 8]}>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>寬度 (W)</Text>
            <InputNumber
              style={{ width: '100%' }}
              min={1} max={srcW}
              value={cropW}
              onChange={(v) => setCropW(v ?? 1)}
              size="small"
              addonAfter="px"
            />
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>高度 (H)</Text>
            <InputNumber
              style={{ width: '100%' }}
              min={1} max={srcH}
              value={cropH}
              onChange={(v) => setCropH(v ?? 1)}
              size="small"
              addonAfter="px"
            />
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>起始 X</Text>
            <InputNumber
              style={{ width: '100%' }}
              min={0} max={srcW - 1}
              value={cropX}
              onChange={(v) => setCropX(v ?? 0)}
              size="small"
              addonAfter="px"
            />
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>起始 Y</Text>
            <InputNumber
              style={{ width: '100%' }}
              min={0} max={srcH - 1}
              value={cropY}
              onChange={(v) => setCropY(v ?? 0)}
              size="small"
              addonAfter="px"
            />
          </Col>
        </Row>

        {!isValid && currentFile && (
          <Text style={{ color: '#ff4d4f', fontSize: 11 }}>
            裁剪範圍超出原始尺寸，請調整
          </Text>
        )}

        <Divider style={{ margin: '4px 0', borderColor: '#222' }} />
        <EffectPreview buildVfFilter={buildVfFilter} />

        {progress && (
          <Text style={{ color: '#aaa', fontSize: 11 }}>處理中 {progress}</Text>
        )}

        <Button
          type="primary"
          block
          icon={<FullscreenExitOutlined />}
          loading={loading}
          onClick={handleApply}
          disabled={!currentFile || !isValid}
        >
          裁剪並儲存
        </Button>
      </Space>
    </div>
  );
};

export default CropPanel;
