import React, { useState } from 'react';
import { Button, Slider, App, Typography, Space, Tag, Divider, Tooltip } from 'antd';
import { BuildOutlined, ScissorOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import { detectScenes, splitVideo, formatTime } from '../../services/ffmpeg';

const { Text } = Typography;

const SceneDetectPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const setCurrentTime = useVideoStore((s) => s.setCurrentTime);

  const [threshold, setThreshold] = useState(0.4);
  const [scenes, setScenes] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);

  const handleDetect = async () => {
    if (!currentFile) return;
    setLoading(true);
    setScenes([]);
    try {
      const result = await detectScenes(currentFile.path, threshold);
      setScenes(result);
      if (result.length === 0) {
        message.info('未偵測到明顯場景切換，可以降低閾值再試');
      } else {
        message.success(`偵測到 ${result.length} 個場景切換點`);
      }
    } catch (err) {
      message.error('偵測失敗: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSplitAll = async () => {
    if (!currentFile || scenes.length === 0) return;
    const outputDir = await open({ directory: true, title: '選擇輸出資料夾' });
    if (!outputDir || typeof outputDir !== 'string') return;

    setSplitting(true);
    try {
      const outputs = await splitVideo(currentFile.path, scenes, outputDir);
      message.success(`已切割為 ${outputs.length} 個片段，儲存至 ${outputDir}`);
    } catch (err) {
      message.error('切割失敗: ' + String(err));
    } finally {
      setSplitting(false);
    }
  };

  const handleJumpTo = (t: number) => {
    setCurrentTime(t);
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}>
        <BuildOutlined /> 場景偵測
      </Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ color: '#888', fontSize: 12 }}>靈敏度閾值: {threshold}</Text>
            <Text style={{ color: '#555', fontSize: 10 }}>數值越小越靈敏</Text>
          </div>
          <Slider min={0.1} max={0.9} step={0.05} value={threshold} onChange={setThreshold} />
        </div>

        <Text style={{ color: '#555', fontSize: 11 }}>
          偵測影片中畫面突然變化的時間點（場景切換），可跳轉預覽或一鍵按場景切割。
        </Text>

        <Button
          type="primary"
          block
          icon={<BuildOutlined />}
          loading={loading}
          onClick={handleDetect}
          disabled={!currentFile}
        >
          開始偵測
        </Button>

        {scenes.length > 0 && (
          <>
            <Divider style={{ margin: '4px 0', borderColor: '#222' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#aaa', fontSize: 11 }}>
                {scenes.length} 個場景切換點（點擊跳轉）
              </Text>
              <Tooltip title="按場景切割成多段影片">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<ScissorOutlined />}
                  loading={splitting}
                  onClick={handleSplitAll}
                >
                  全部切割
                </Button>
              </Tooltip>
            </div>

            <div style={{ maxHeight: 200, overflow: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {scenes.map((t, i) => (
                <Tooltip key={i} title="點擊跳轉至此時間點">
                  <Tag
                    icon={<PlayCircleOutlined />}
                    color="blue"
                    style={{ cursor: 'pointer', fontSize: 10, marginBottom: 2 }}
                    onClick={() => handleJumpTo(t)}
                  >
                    {formatTime(t)}
                  </Tag>
                </Tooltip>
              ))}
            </div>

            <Text style={{ color: '#555', fontSize: 10 }}>
              「全部切割」會將影片在所有場景點切開，輸出多個片段至你選擇的資料夾。
            </Text>
          </>
        )}
      </Space>
    </div>
  );
};

export default SceneDetectPanel;
