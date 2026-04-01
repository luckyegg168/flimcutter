import React, { useState, useEffect, useRef } from 'react';
import { Button, Select, App, Typography, Space, Divider, Progress } from 'antd';
import { FunctionOutlined, DownloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useVideoStore } from '../../stores/videoStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { transcribeVideo, generateSrt, generateVtt } from '../../services/asr';
import type { AsrResult } from '../../types';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';

const { Text, Paragraph } = Typography;

const AsrPanel: React.FC = () => {
  const { message } = App.useApp();
  const currentFile = useVideoStore((s) => s.currentFile);
  const asrApiUrl = useSettingsStore((s) => s.asrApiUrl);
  const asrModel = useSettingsStore((s) => s.asrModel);
  const [language, setLanguage] = useState<string>('auto');
  const [task, setTask] = useState<'transcribe' | 'translate'>('transcribe');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AsrResult | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [chunkInfo, setChunkInfo] = useState<{ chunk: number; total: number } | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  const handleTranscribe = async () => {
    if (!currentFile) { message.warning('請先開啟影片'); return; }
    if (!asrApiUrl) { message.warning('請先在設定中填寫 ASR API URL'); return; }
    setLoading(true);
    setResult(null);
    setChunkInfo(null);
    setProgress('正在分析影片時長…');

    unlistenRef.current = await listen<{ chunk: number; total: number; message: string }>(
      'asr://progress',
      (ev) => {
        setProgress(ev.payload.message);
        setChunkInfo({ chunk: ev.payload.chunk, total: ev.payload.total });
      }
    );

    try {
      const res = await transcribeVideo(currentFile.path, { apiUrl: asrApiUrl, model: asrModel, language: language === 'auto' ? undefined : language, task });
      setResult(res);
      setProgress('');
      setChunkInfo(null);
      message.success('辨識完成！');
    } catch (err) {
      setProgress('');
      setChunkInfo(null);
      message.error('ASR 失敗: ' + String(err));
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
      setLoading(false);
    }
  };

  const saveSrt = async () => {
    if (!result) return;
    const path = await save({ defaultPath: (currentFile?.name ?? 'subtitle').replace(/\.[^.]+$/, '.srt'), filters: [{ name: 'SRT', extensions: ['srt'] }] });
    if (!path) return;
    await writeTextFile(path, generateSrt(result.segments ?? []));
    message.success('SRT 已儲存');
  };

  const saveVtt = async () => {
    if (!result) return;
    const path = await save({ defaultPath: (currentFile?.name ?? 'subtitle').replace(/\.([^.]+)$/, '.vtt'), filters: [{ name: 'VTT', extensions: ['vtt'] }] });
    if (!path) return;
    await writeTextFile(path, generateVtt(result.segments ?? []));
    message.success('VTT 已儲存');
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 10 }}><FunctionOutlined /> 語音辨識 (ASR)</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Text style={{ color: '#888', fontSize: 12 }}>語言</Text>
            <Select value={language} onChange={setLanguage} style={{ width: '100%' }} size="small">
              <Select.Option value="auto">自動偵測</Select.Option>
              <Select.Option value="zh">中文</Select.Option>
              <Select.Option value="en">英文</Select.Option>
              <Select.Option value="ja">日文</Select.Option>
              <Select.Option value="ko">韓文</Select.Option>
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <Text style={{ color: '#888', fontSize: 12 }}>任務</Text>
            <Select value={task} onChange={(v) => setTask(v as any)} style={{ width: '100%' }} size="small">
              <Select.Option value="transcribe">轉錄</Select.Option>
              <Select.Option value="translate">翻譯成英文</Select.Option>
            </Select>
          </div>
        </div>

        {!asrApiUrl && (
          <Text style={{ color: '#ff6b6b', fontSize: 11 }}>⚠️ 請在設定中填寫 ASR API URL</Text>
        )}

        {loading && (
          <>
            <Text style={{ color: '#aaa', fontSize: 11 }}>{progress}</Text>
            {chunkInfo && (
              <Progress
                percent={Math.round((chunkInfo.chunk / chunkInfo.total) * 100)}
                size="small"
                format={() => `${chunkInfo.chunk}/${chunkInfo.total}`}
                strokeColor="#1677ff"
              />
            )}
          </>
        )}

        <Button type="primary" block icon={<FunctionOutlined />} loading={loading} onClick={handleTranscribe} disabled={!currentFile}>
          開始辨識
        </Button>

        {result && (
          <>
            <Divider style={{ margin: '8px 0', borderColor: '#333' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text style={{ color: '#52c41a', fontSize: 12 }}>辨識完成 ({result.segments?.length ?? 0} 段)</Text>
            </div>
            <div style={{ background: '#111', borderRadius: 6, padding: 8, maxHeight: 150, overflow: 'auto' }}>
              <Paragraph style={{ color: '#ccc', fontSize: 11, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {result.text}
              </Paragraph>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="small" icon={<DownloadOutlined />} onClick={saveSrt} style={{ flex: 1 }}>SRT</Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={saveVtt} style={{ flex: 1 }}>VTT</Button>
            </div>
          </>
        )}
      </Space>
    </div>
  );
};

export default AsrPanel;
