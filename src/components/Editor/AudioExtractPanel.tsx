import React, { useState } from 'react';
import { Button, Select, App, Typography, Space } from 'antd';
import { AudioOutlined } from '@ant-design/icons';
import { save } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { extractAudio } from '../../services/ffmpeg';

const { Text } = Typography;

const AudioExtractPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const [format, setFormat] = useState('mp3');
  const [loading, setLoading] = useState(false);

  const handleExtract = async () => {
    if (!currentFile) return;
    const outputPath = await save({
      defaultPath: currentFile.path.replace(/\.[^.]+$/, `.${format}`),
      filters: [{ name: '音訊', extensions: [format] }],
    });
    if (!outputPath) return;
    setLoading(true);
    try {
      await extractAudio(currentFile.path, outputPath, format);
      message.success('音訊提取完成！');
    } catch (err) {
      message.error('提取失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><AudioOutlined /> 提取音訊</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>輸出格式</Text>
          <Select value={format} onChange={setFormat} style={{ width: '100%' }} size="small">
            <Select.Option value="mp3">MP3</Select.Option>
            <Select.Option value="aac">AAC</Select.Option>
            <Select.Option value="wav">WAV</Select.Option>
            <Select.Option value="flac">FLAC</Select.Option>
            <Select.Option value="ogg">OGG</Select.Option>
            <Select.Option value="m4a">M4A</Select.Option>
          </Select>
        </div>
        <Button type="primary" block icon={<AudioOutlined />} loading={loading} onClick={handleExtract} disabled={!currentFile}>
          提取音訊
        </Button>
      </Space>
    </div>
  );
};

export default AudioExtractPanel;
