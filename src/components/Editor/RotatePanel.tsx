import React, { useState } from 'react';
import { Button, Radio, App, Typography, Space } from 'antd';
import { RotateRightOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { rotateVideo } from '../../services/ffmpeg';

const { Text } = Typography;

const RotatePanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [flip, setFlip] = useState<'none' | 'hflip' | 'vflip'>('none');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_rotated.mp4`),
      filters: [{ name: '影片', extensions: ['mp4'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    try {
      await rotateVideo(currentFile.path, outputPath, rotation, flip !== 'none' ? flip : undefined);
      message.success('旋轉完成！');
    } catch (err) {
      message.error('處理失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><RotateRightOutlined /> 旋轉翻轉</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>旋轉角度</Text>
          <Radio.Group value={rotation} onChange={(e) => setRotation(e.target.value)} buttonStyle="solid" size="small">
            <Radio.Button value={90}>順時 90°</Radio.Button>
            <Radio.Button value={180}>180°</Radio.Button>
            <Radio.Button value={270}>逆時 90°</Radio.Button>
          </Radio.Group>
        </div>
        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 6 }}>翻轉</Text>
          <Radio.Group value={flip} onChange={(e) => setFlip(e.target.value)} buttonStyle="solid" size="small">
            <Radio.Button value="none">無</Radio.Button>
            <Radio.Button value="hflip">水平翻轉</Radio.Button>
            <Radio.Button value="vflip">垂直翻轉</Radio.Button>
          </Radio.Group>
        </div>
        <Button type="primary" block icon={<RotateRightOutlined />} loading={loading} onClick={handleApply} disabled={!currentFile}>
          套用
        </Button>
      </Space>
    </div>
  );
};

export default RotatePanel;
