import React, { useState } from 'react';
import { Button, Select, App, Typography, Space, Row, Col, Slider } from 'antd';
import { RetweetOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { convertVideo } from '../../services/ffmpeg';

const { Text } = Typography;

const ConvertPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [container, setContainer] = useState('mp4');
  const [vcodec, setVcodec] = useState('libx264');
  const [acodec] = useState('aac');
  const [crf, setCrf] = useState(23);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `_converted.${container}`),
      filters: [{ name: '影片', extensions: [container] }],
    });
    if (!outputPath) return;
    setLoading(true);
    try {
      await convertVideo(currentFile.path, outputPath, { videoCodec: vcodec, audioCodec: acodec, crf });
      message.success('轉換完成！');
    } catch (err) {
      message.error('轉換失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><RetweetOutlined /> 格式轉換</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Row gutter={8}>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>容器格式</Text>
            <Select value={container} onChange={setContainer} style={{ width: '100%' }} size="small">
              {['mp4','mkv','avi','mov','webm','flv','wmv','ts'].map(f => <Select.Option key={f} value={f}>{f.toUpperCase()}</Select.Option>)}
            </Select>
          </Col>
          <Col span={12}>
            <Text style={{ color: '#888', fontSize: 12 }}>視訊編碼</Text>
            <Select value={vcodec} onChange={setVcodec} style={{ width: '100%' }} size="small">
              <Select.Option value="libx264">H.264</Select.Option>
              <Select.Option value="libx265">H.265/HEVC</Select.Option>
              <Select.Option value="libvpx-vp9">VP9</Select.Option>
              <Select.Option value="copy">複製 (不重編)</Select.Option>
            </Select>
          </Col>
        </Row>
        <div>
          <Text style={{ color: '#888', fontSize: 12 }}>CRF 品質 ({crf})</Text>
          <Slider min={0} max={51} value={crf} onChange={setCrf} />
        </div>
        <Button type="primary" block icon={<RetweetOutlined />} loading={loading} onClick={handleConvert} disabled={!currentFile}>
          開始轉換
        </Button>
      </Space>
    </div>
  );
};

export default ConvertPanel;
