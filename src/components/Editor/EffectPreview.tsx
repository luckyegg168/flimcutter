import React, { useState } from 'react';
import { Button, App, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useVideoStore } from '../../stores/videoStore';
import { previewFrameEffect } from '../../services/ffmpeg';

interface EffectPreviewProps {
  buildVfFilter: () => string | null;
}

const EffectPreview: React.FC<EffectPreviewProps> = ({ buildVfFilter }) => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const currentTime = useVideoStore((s) => s.currentTime);
  const [loading, setLoading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const vfFilter = buildVfFilter();

  const handlePreview = async () => {
    if (!currentFile || !vfFilter) return;
    setLoading(true);
    try {
      const src = await previewFrameEffect(currentFile.path, currentTime, vfFilter);
      setPreviewSrc(src);
    } catch (err) {
      message.error('預覽失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Button
        size="small"
        block
        icon={<EyeOutlined />}
        loading={loading}
        onClick={handlePreview}
        disabled={!currentFile || !vfFilter}
      >
        預覽效果
      </Button>
      {previewSrc && (
        <img
          src={previewSrc}
          alt="預覽"
          style={{
            width: '100%',
            maxHeight: 160,
            objectFit: 'contain',
            borderRadius: 4,
            background: '#000',
            display: 'block',
          }}
        />
      )}
    </Space>
  );
};

export default EffectPreview;
