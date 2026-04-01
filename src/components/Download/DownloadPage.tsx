import React, { useState, useCallback, useRef } from 'react';
import {
  Input,
  Button,
  Select,
  Progress,
  Tag,
  Image,
  Empty,
  Typography,
  Space,
  App,
  Divider,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useDownloadStore } from '../../stores/downloadStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getVideoInfo, startDownload, cancelDownload, formatDuration } from '../../services/downloader';
import { DownloadTask, VideoFormat } from '../../types';

const { Text, Title } = Typography;
const { Option } = Select;

const DownloadPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const tasks = useDownloadStore((s) => s.tasks);
  const addTask = useDownloadStore((s) => s.addTask);
  const updateTask = useDownloadStore((s) => s.updateTask);
  const removeTask = useDownloadStore((s) => s.removeTask);
  const clearCompleted = useDownloadStore((s) => s.clearCompleted);
  const setVideoInfo = useDownloadStore((s) => s.setVideoInfo);
  const setFormat = useDownloadStore((s) => s.setFormat);

  const defaultOutputDir = useSettingsStore((s) => s.defaultOutputDir);
  const [outputDir, setOutputDir] = useState(defaultOutputDir || '');

  const handleAnalyze = useCallback(async () => {
    if (!url.trim()) {
      message.warning(t('download.errors.invalidUrl'));
      return;
    }
    setAnalyzing(true);
    try {
      const info = await getVideoInfo(url.trim());
      const taskId = addTask(url.trim(), outputDir);
      setVideoInfo(taskId, info);
      // Pick best format by default
      const bestFmt = info.formats
        .filter((f) => f.hasVideo && f.hasAudio)
        .sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0))[0];
      if (bestFmt) {
        setFormat(taskId, bestFmt);
      }
      setUrl('');
    } catch (err) {
      message.error(`解析失敗: ${err}`);
    } finally {
      setAnalyzing(false);
    }
  }, [url, outputDir, addTask, setVideoInfo, setFormat, t, message, tasks]);

  const handleSelectDir = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      setOutputDir(selected);
    }
  }, []);

  const handleStartDownload = useCallback(async (task: DownloadTask) => {
    if (!task.videoInfo || !task.selectedFormat) {
      message.warning('請先選擇下載格式');
      return;
    }
    const dir = task.outputDir || outputDir || '.';
    updateTask(task.id, { status: 'downloading', progress: 0 });

    const unlisten = await startDownload(
      task.id,
      task.url,
      task.selectedFormat.formatId,
      dir,
      (progress, speed, eta) => {
        updateTask(task.id, { progress, speed, eta });
      },
      (outputPath) => {
        updateTask(task.id, { status: 'completed', progress: 100, outputPath });
        message.success(`${task.videoInfo?.title ?? '影片'} 下載完成`);
      },
      (error) => {
        updateTask(task.id, { status: 'failed', error });
        message.error(`下載失敗: ${error}`);
      }
    );
    unlistenRef.current = unlisten;
  }, [outputDir, updateTask, message]);

  const handleCancel = useCallback(async (taskId: string) => {
    await cancelDownload(taskId);
    updateTask(taskId, { status: 'cancelled' });
    unlistenRef.current?.();
  }, [updateTask]);

  const getStatusTag = (task: DownloadTask) => {
    switch (task.status) {
      case 'analyzing':
        return <Tag icon={<LoadingOutlined />} color="processing">解析中</Tag>;
      case 'downloading':
        return <Tag icon={<LoadingOutlined />} color="processing">{t('download.downloading')}</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="success">{t('download.completed')}</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">{t('download.failed')}</Tag>;
      default:
        return <Tag>{t('common.status')}: {task.status}</Tag>;
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16, gap: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div>
        <Title level={5} style={{ color: '#fff', margin: 0, marginBottom: 12 }}>
          <DownloadOutlined style={{ marginRight: 8 }} />
          {t('download.title')}
        </Title>

        {/* URL input */}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPressEnter={handleAnalyze}
            placeholder={t('download.urlPlaceholder')}
            style={{ background: '#1f1f1f', borderColor: '#303030' }}
            prefix={<SearchOutlined style={{ color: '#555' }} />}
            size="middle"
            allowClear
          />
          <Button
            type="primary"
            onClick={handleAnalyze}
            loading={analyzing}
            icon={<SearchOutlined />}
          >
            {t('download.analyzeBtn')}
          </Button>
        </Space.Compact>

        {/* Output dir */}
        <Space style={{ marginTop: 8, width: '100%' }} size={6}>
          <Text style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{t('download.outputDir')}:</Text>
          <Input
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
            placeholder={t('download.selectOutputDir')}
            style={{ flex: 1, background: '#1f1f1f', borderColor: '#303030', fontSize: 12 }}
            size="small"
          />
          <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectDir}>
            {t('common.browse')}
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: '4px 0', borderColor: '#222' }} />

      {/* Download Queue */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#888', fontSize: 12 }}>
            {t('download.queue')} ({tasks.length})
          </Text>
          {tasks.some((t) => t.status === 'completed' || t.status === 'failed') && (
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={clearCompleted}
              type="text"
              style={{ color: '#888', fontSize: 11 }}
            >
              {t('download.clearBtn')}
            </Button>
          )}
        </div>

        {tasks.length === 0 ? (
          <Empty
            description={<Text style={{ color: '#555', fontSize: 12 }}>{t('download.queueEmpty')}</Text>}
            style={{ marginTop: 60 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          tasks.map((task) => (
            <DownloadTaskItem
              key={task.id}
              task={task}
              onStart={handleStartDownload}
              onCancel={handleCancel}
              onRemove={removeTask}
              onFormatChange={(id, fmt) => setFormat(id, fmt)}
              t={t}
              getStatusTag={getStatusTag}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface TaskItemProps {
  task: DownloadTask;
  onStart: (task: DownloadTask) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onFormatChange: (id: string, format: VideoFormat) => void;
  t: (key: string) => string;
  getStatusTag: (task: DownloadTask) => React.ReactNode;
}

const DownloadTaskItem: React.FC<TaskItemProps> = ({
  task, onStart, onCancel, onRemove, onFormatChange, t, getStatusTag
}) => {
  const info = task.videoInfo;

  return (
    <div className="download-task-item">
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Thumbnail */}
        {info?.thumbnail && (
          <Image
            src={info.thumbnail}
            width={80}
            height={45}
            style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
            preview={false}
          />
        )}

        {/* Info */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <Text
              style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}
              ellipsis
              title={info?.title ?? task.url}
            >
              {info?.title ?? task.url}
            </Text>
            {getStatusTag(task)}
          </div>

          {info && (
            <Text style={{ color: '#888', fontSize: 11 }}>
              {info.uploader && `${info.uploader} · `}
              {formatDuration(info.duration)}
            </Text>
          )}

          {/* Format selector */}
          {info && task.status === 'pending' && (
            <Select
              size="small"
              style={{ width: '100%', marginTop: 6 }}
              value={task.selectedFormat?.formatId}
              onChange={(value) => {
                const fmt = info.formats.find((f) => f.formatId === value);
                if (fmt) onFormatChange(task.id, fmt);
              }}
              placeholder={t('download.selectFormat')}
            >
              {info.formats
                .filter((f) => f.hasVideo || f.hasAudio)
                .map((fmt) => (
                  <Option key={fmt.formatId} value={fmt.formatId}>
                    <span style={{ fontSize: 11 }}>
                      {fmt.resolution ?? (fmt.hasAudio && !fmt.hasVideo ? '純音訊' : '')}
                      {fmt.ext && ` [${fmt.ext.toUpperCase()}]`}
                      {fmt.filesize && ` ~${(fmt.filesize / 1024 / 1024).toFixed(1)}MB`}
                    </span>
                  </Option>
                ))}
            </Select>
          )}

          {/* Progress */}
          {task.status === 'downloading' && (
            <div style={{ marginTop: 6 }}>
              <Progress
                percent={Math.round(task.progress)}
                size="small"
                strokeColor="#1677ff"
                trailColor="#222"
                style={{ marginBottom: 2 }}
              />
              <Text style={{ color: '#888', fontSize: 10 }}>
                {task.speed && `${t('download.speed')}: ${task.speed}`}
                {task.eta && ` · ${t('download.eta')}: ${task.eta}`}
              </Text>
            </div>
          )}

          {task.error && (
            <Text style={{ color: '#ff4d4f', fontSize: 11 }}>{task.error}</Text>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
          {task.status === 'pending' && (
            <Tooltip title={t('download.downloadBtn')}>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => onStart(task)}
                disabled={!task.selectedFormat}
              />
            </Tooltip>
          )}
          {task.status === 'downloading' && (
            <Tooltip title={t('download.cancelBtn')}>
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => onCancel(task.id)}
              />
            </Tooltip>
          )}
          <Tooltip title={t('common.delete')}>
            <Button
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => onRemove(task.id)}
              type="text"
              style={{ color: '#888' }}
              disabled={task.status === 'downloading'}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
