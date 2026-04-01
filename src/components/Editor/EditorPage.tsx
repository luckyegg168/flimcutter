import React, { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Typography,
  App,
  Tooltip,
} from 'antd';
import { listen } from '@tauri-apps/api/event';
import {
  FolderOpenOutlined,
  ScissorOutlined,
  SplitCellsOutlined,
  MergeCellsOutlined,
  AudioOutlined,
  RetweetOutlined,
  CompressOutlined,
  CameraOutlined,
  FileGifOutlined,
  FieldTimeOutlined,
  RotateRightOutlined,
  SoundOutlined,
  BuildOutlined,
  FunctionOutlined,
  FontSizeOutlined,
  FullscreenExitOutlined,
  BorderOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useVideoStore } from '../../stores/videoStore';
import VideoPlayer from '../VideoPlayer/VideoPlayer';
import Timeline from '../Timeline/Timeline';
import TrimPanel from './TrimPanel';
import SplitPanel from './SplitPanel';
import MergePanel from './MergePanel';
import AudioExtractPanel from './AudioExtractPanel';
import ConvertPanel from './ConvertPanel';
import CompressPanel from './CompressPanel';
import ScreenshotPanel from './ScreenshotPanel';
import GifPanel from './GifPanel';
import SpeedPanel from './SpeedPanel';
import RotatePanel from './RotatePanel';
import VolumePanel from './VolumePanel';
import SceneDetectPanel from './SceneDetectPanel';
import AsrPanel from '../Settings/AsrPanel';
import WatermarkPanel from './WatermarkPanel';
import CropPanel from './CropPanel';
import BorderPanel from './BorderPanel';
import FloatingImagePanel from './FloatingImagePanel';
import { getVideoInfo } from '../../services/ffmpeg';

const { Text } = Typography;

const EditorPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const setCurrentFile = useVideoStore((s) => s.setCurrentFile);
  const currentTime = useVideoStore((s) => s.currentTime);
  const duration = useVideoStore((s) => s.duration);
  const setCurrentTime = useVideoStore((s) => s.setCurrentTime);
  const [activeTab, setActiveTab] = useState('trim');
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Define handleOpenFile first so Effects can reference it ──────────────
  const handleOpenFile = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: '影片檔案',
          extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mts', '3gp'],
        },
        { name: '所有檔案', extensions: ['*'] },
      ],
    });
    if (selected && typeof selected === 'string') {
      try {
        const info = await getVideoInfo(selected);
        setCurrentFile(info);
      } catch (err) {
        message.error('無法開啟影片: ' + String(err));
      }
    }
  }, [setCurrentFile, message]);

  // ── Tauri drag-drop file import ───────────────────────────────────────────
  useEffect(() => {
    const VIDEO_EXTS = /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v|ts|mts|3gp)$/i;
    const dropP  = listen<{ paths: string[] }>('tauri://drag-drop', async (e) => {
      setIsDragOver(false);
      const paths = e.payload.paths.filter((p) => VIDEO_EXTS.test(p));
      if (paths.length === 0) return;
      try {
        const info = await getVideoInfo(paths[0]);
        setCurrentFile(info);
      } catch (err) {
        message.error('無法開啟影片: ' + String(err));
      }
    });
    const enterP = listen('tauri://drag-enter', () => setIsDragOver(true));
    const leaveP = listen('tauri://drag-leave', () => setIsDragOver(false));
    return () => {
      dropP.then((fn) => fn());
      enterP.then((fn) => fn());
      leaveP.then((fn) => fn());
    };
  }, [setCurrentFile, message, handleOpenFile]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // ← / → seek ±5s (±1s with Shift);  Ctrl+O open file
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTime(Math.max(0, currentTime - (e.shiftKey ? 1 : 5)));
      } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCurrentTime(Math.min(duration, currentTime + (e.shiftKey ? 1 : 5)));
      } else if (e.key === 'o' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleOpenFile();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentTime, duration, setCurrentTime, handleOpenFile]);

  const tabs = [
    { key: 'trim',     icon: <ScissorOutlined />,      label: '裁切' },
    { key: 'split',    icon: <SplitCellsOutlined />,    label: '分割' },
    { key: 'merge',    icon: <MergeCellsOutlined />,    label: '合併' },
    { key: 'audio',    icon: <AudioOutlined />,         label: '音訊' },
    { key: 'convert',  icon: <RetweetOutlined />,       label: '轉換' },
    { key: 'compress', icon: <CompressOutlined />,      label: '壓縮' },
    { key: 'screenshot',icon: <CameraOutlined />,       label: '截圖' },
    { key: 'gif',      icon: <FileGifOutlined />,       label: 'GIF' },
    { key: 'speed',    icon: <FieldTimeOutlined />,     label: '速度' },
    { key: 'rotate',   icon: <RotateRightOutlined />,   label: '旋轉' },
    { key: 'volume',   icon: <SoundOutlined />,         label: '音量' },
    { key: 'scene',    icon: <BuildOutlined />,         label: '場景' },
    { key: 'watermark',icon: <FontSizeOutlined />,      label: '浮水印' },
    { key: 'crop',     icon: <FullscreenExitOutlined />, label: '裁剪' },
    { key: 'border',   icon: <BorderOutlined />,        label: '邊框' },
    { key: 'floating', icon: <PictureOutlined />,       label: '浮動圖' },
    { key: 'asr',      icon: <FunctionOutlined />,      label: 'ASR' },
  ];

  return (
    <div
      style={{ height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}
    >
      {/* Drag-over overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(22, 119, 255, 0.18)',
          border: '2px dashed #1677ff',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ color: '#1677ff', fontSize: 18, fontWeight: 600 }}>拖放影片至此</span>
        </div>
      )}
      {/* Left - Player area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: 12, gap: 8 }}>
        {/* Player */}
        <div style={{ flex: 1, minHeight: 0, background: '#0a0a0a', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {currentFile ? (
            <VideoPlayer filePath={currentFile.path} />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                padding: 40,
              }}
              onClick={handleOpenFile}
            >
              <FolderOpenOutlined style={{ fontSize: 48, color: '#333' }} />
              <Text style={{ color: '#555', fontSize: 13 }}>{t('editor.dragHint')}</Text>
              <Button type="primary" ghost icon={<FolderOpenOutlined />} onClick={(e) => { e.stopPropagation(); handleOpenFile(); }}>
                {t('editor.openFile')}
              </Button>
            </div>
          )}
        </div>

        {/* Timeline */}
        {currentFile && (
          <div style={{ height: 100, flexShrink: 0 }}>
            <Timeline />
          </div>
        )}

        {/* File info bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 28,
          flexShrink: 0,
          padding: '0 4px',
        }}>
          <Button size="small" icon={<FolderOpenOutlined />} onClick={handleOpenFile}>
            開啟檔案
          </Button>
          {currentFile && (
            <Text style={{ color: '#666', fontSize: 11 }} ellipsis>
              {currentFile.name}
              {currentFile.width && ` · ${currentFile.width}×${currentFile.height}`}
              {currentFile.duration && ` · ${formatDuration(currentFile.duration)}`}
              {currentFile.fps && ` · ${currentFile.fps}fps`}
            </Text>
          )}
        </div>
      </div>

      {/* Right - Tools panel */}
      <div style={{
        width: 300,
        flexShrink: 0,
        background: '#1a1a1a',
        borderLeft: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Tool tabs (icon-only vertical scroll) */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          padding: '8px 6px 4px',
          borderBottom: '1px solid #222',
        }}>
          {tabs.map((tab) => (
            <Tooltip key={tab.key} title={tab.label}>
              <Button
                type={activeTab === tab.key ? 'primary' : 'text'}
                size="small"
                icon={tab.icon}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  height: 26,
                  minWidth: 0,
                  color: activeTab === tab.key ? undefined : '#888',
                }}
              >
                {tab.label}
              </Button>
            </Tooltip>
          ))}
        </div>

        {/* Tool content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
          {!currentFile && activeTab !== 'merge' && activeTab !== 'asr' && (
            <Text style={{ color: '#555', fontSize: 12 }}>
              ⚠️ 請先開啟影片
            </Text>
          )}
          {activeTab === 'trim' && <TrimPanel />}
          {activeTab === 'split' && <SplitPanel />}
          {activeTab === 'merge' && <MergePanel />}
          {activeTab === 'audio' && <AudioExtractPanel />}
          {activeTab === 'convert' && <ConvertPanel />}
          {activeTab === 'compress' && <CompressPanel />}
          {activeTab === 'screenshot' && <ScreenshotPanel />}
          {activeTab === 'gif' && <GifPanel />}
          {activeTab === 'speed' && <SpeedPanel />}
          {activeTab === 'rotate' && <RotatePanel />}
          {activeTab === 'volume' && <VolumePanel />}
          {activeTab === 'scene' && <SceneDetectPanel />}
          {activeTab === 'watermark' && <WatermarkPanel />}
          {activeTab === 'crop' && <CropPanel />}
          {activeTab === 'border' && <BorderPanel />}
          {activeTab === 'floating' && <FloatingImagePanel />}
          {activeTab === 'asr' && <AsrPanel />}
        </div>
      </div>
    </div>
  );
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default EditorPage;
