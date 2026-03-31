import React, { useState } from 'react';
import { Button, Slider, Select, App, Typography, Space, Row, Col } from 'antd';
import { CompressOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { compressVideo } from '../../services/ffmpeg';

const { Text } = Typography;

const CompressPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [crf, setCrf] = useState(28);
  const [preset, setPreset] = useState('medium');
  const [resolution, setResolution] = useState('original');
  const [loading, setLoading] = useState(false);

  const handleCompress = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_compressed.mp4`),
      filters: [{ name: '影片', extensions: ['mp4'] }],
    });
    if (!outputPath) return;
    setLoading(true);
    try {
      await compressVideo(currentFile.path, outputPath, { crf, preset, resolution: resolution === 'original' ? undefined : resolution });
      message.success('壓縮完成！');
    } catch (err) {
      message.error('壓縮失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const qualityLabel = crf <= 18 ? '高品質' : crf <= 24 ? '一般' : crf <= 30 ? '低品質' : '非常低';

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><CompressOutlined /> 影片壓縮</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <Text style={{ color: '#888', fontSize: 12 }}>CRF 品質: {qualityLabel} ({crf})</Text>
          <Slider min={18} max={51} value={crf} onChange={setCrf} />
        </div>
        <Row gutter={8}>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>速度預設</Text>
            <Select value={preset} onChange={setPreset} style={{ width: '100%' }} size="small">
              {['ultrafast','superfast','veryfast','faster','fast','medium','slow','slower','veryslow'].map(p => (
                <Select.Option key={p} value={p}>{p}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>解析度</Text>
            <Select value={resolution} onChange={setResolution} style={{ width: '100%' }} size="small">
              <Select.Option value="original">原始</Select.Option>
              <Select.Option value="1920x1080">1080p</Select.Option>
              <Select.Option value="1280x720">720p</Select.Option>
              <Select.Option value="854x480">480p</Select.Option>
              <Select.Option value="640x360">360p</Select.Option>
            </Select>
          </Col>
        </Row>
        <Button type="primary" block icon={<CompressOutlined />} loading={loading} onClick={handleCompress} disabled={!currentFile}>
          開始壓縮
        </Button>
      </Space>
    </div>
  );
};

export default CompressPanel;
