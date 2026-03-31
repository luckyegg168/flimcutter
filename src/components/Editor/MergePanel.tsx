import React, { useState } from 'react';
import { Button, App, Typography, Space, Tag } from 'antd';
import { MergeCellsOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { open, save } from '@tauri-apps/plugin-dialog';
import { mergeVideos } from '../../services/ffmpeg';

const { Text } = Typography;

const MergePanel: React.FC = () => {
  const { message } = App.useApp();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: '影片', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv'] }],
    });
    if (selected) {
      const arr = Array.isArray(selected) ? selected : [selected];
      setFiles((prev) => [...prev, ...arr]);
    }
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleMerge = async () => {
    if (files.length < 2) { message.warning('請新增至少兩個影片檔案'); return; }
    const outputPath = await save({ filters: [{ name: '影片', extensions: ['mp4'] }] });
    if (!outputPath) return;
    setLoading(true);
    try {
      await mergeVideos(files, outputPath);
      message.success('合併完成！');
    } catch (err) {
      message.error('合併失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <MergeCellsOutlined /> 影片合併
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        <Button size="small" icon={<PlusOutlined />} onClick={addFiles} block>
          新增影片檔案
        </Button>
        {files.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#222', padding: '4px 8px', borderRadius: 4 }}>
            <Tag color="default" style={{ fontSize: 10 }}>{i + 1}</Tag>
            <Text style={{ flex: 1, fontSize: 11, color: '#bbb' }} ellipsis>{f.split(/[/\\]/).pop()}</Text>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeFile(i)} />
          </div>
        ))}
        <Button type="primary" block icon={<MergeCellsOutlined />} loading={loading} onClick={handleMerge} disabled={files.length < 2}>
          合併 ({files.length} 個)
        </Button>
      </Space>
    </div>
  );
};

export default MergePanel;
