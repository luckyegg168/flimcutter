import React, { useState } from 'react';
import {
  Input,
  Button,
  Typography,
  Space,
  Divider,
  App,
  Row,
  Col,
  Badge,
} from 'antd';
import {
  FolderOpenOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/settingsStore';
import { testAsrConnection } from '../../services/asr';
import { invoke } from '@tauri-apps/api/core';

const { Text, Title } = Typography;

const SettingsPage: React.FC = () => {
  const { message } = App.useApp();
  const {
    defaultOutputDir, setDefaultOutputDir,
    asrApiUrl, setAsrApiUrl,
    asrModel, setAsrModel,
    ffmpegPath, setFfmpegPath,
    ytdlpPath, setYtdlpPath,
    resetSettings,
  } = useSettingsStore();

  const [asrTesting, setAsrTesting] = useState(false);
  const [asrStatus, setAsrStatus] = useState<'untested' | 'ok' | 'fail'>('untested');
  const [ffmpegVersion, setFfmpegVersion] = useState<string>('');
  const [ytdlpVersion, setYtdlpVersion] = useState<string>('');

  const selectOutputDir = async () => {
    const dir = await open({ directory: true, title: '選擇預設輸出資料夾' });
    if (dir && typeof dir === 'string') setDefaultOutputDir(dir);
  };

  const testAsr = async () => {
    if (!asrApiUrl) { message.warning('請填寫 ASR API URL'); return; }
    setAsrTesting(true);
    setAsrStatus('untested');
    try {
      const ok = await testAsrConnection(asrApiUrl);
      setAsrStatus(ok ? 'ok' : 'fail');
      message.success(ok ? 'ASR 連線成功！' : 'ASR 回應異常');
    } catch {
      setAsrStatus('fail');
      message.error('ASR 連線失敗');
    } finally {
      setAsrTesting(false);
    }
  };

  const checkFfmpeg = async () => {
    try {
      const v = await invoke<string>('get_ffmpeg_version');
      setFfmpegVersion(v);
      message.success('FFmpeg 已就緒');
    } catch (err) {
      message.error('找不到 FFmpeg: ' + String(err));
    }
  };

  const checkYtdlp = async () => {
    try {
      const v = await invoke<string>('get_ytdlp_version');
      setYtdlpVersion(v);
      message.success('yt-dlp 已就緒');
    } catch (err) {
      message.error('找不到 yt-dlp: ' + String(err));
    }
  };

  const sectionStyle: React.CSSProperties = { marginBottom: 20 };

  return (
    <div style={{ padding: 20, maxWidth: 580, overflowY: 'auto', height: '100%' }}>
      <Title level={5} style={{ marginBottom: 20, color: '#fff' }}>⚙️ 應用程式設定</Title>

      {/* Output directory */}
      <div style={sectionStyle}>
        <Text strong style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>📁 預設輸出資料夾</Text>
        <Input
          value={defaultOutputDir}
          onChange={(e) => setDefaultOutputDir(e.target.value)}
          suffix={
            <Button size="small" type="text" icon={<FolderOpenOutlined />} onClick={selectOutputDir} />
          }
          placeholder="選擇預設輸出資料夾..."
          style={{ fontSize: 12 }}
        />
      </div>

      <Divider style={{ borderColor: '#222' }} />

      {/* ASR */}
      <div style={sectionStyle}>
        <Text strong style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>
          <ApiOutlined /> ASR 語音辨識
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>API URL</Text>
            <Input
              value={asrApiUrl}
              onChange={(e) => { setAsrApiUrl(e.target.value); setAsrStatus('untested'); }}
              placeholder="http://localhost:8000/v1"
              style={{ fontSize: 12 }}
            />
          </div>
          <div>
            <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>模型名稱</Text>
            <Input
              value={asrModel}
              onChange={(e) => setAsrModel(e.target.value)}
              placeholder="Qwen/Qwen3-ASR-1.7B"
              style={{ fontSize: 12 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              loading={asrTesting}
              onClick={testAsr}
            >
              測試連線
            </Button>
            {asrStatus === 'ok' && <Badge status="success" text={<Text style={{ color: '#52c41a', fontSize: 12 }}>連線成功</Text>} />}
            {asrStatus === 'fail' && <Badge status="error" text={<Text style={{ color: '#ff4d4f', fontSize: 12 }}>連線失敗</Text>} />}
          </div>
        </Space>
      </div>

      <Divider style={{ borderColor: '#222' }} />

      {/* Binaries */}
      <div style={sectionStyle}>
        <Text strong style={{ color: '#ccc', display: 'block', marginBottom: 8 }}>
          <ToolOutlined /> 工具二進位檔
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Row gutter={8} align="middle">
            <Col flex={1}>
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>FFmpeg 路徑</Text>
              <Input
                value={ffmpegPath}
                onChange={(e) => setFfmpegPath(e.target.value)}
                placeholder="(使用嵌入版本)"
                style={{ fontSize: 12 }}
              />
            </Col>
            <Col style={{ paddingTop: 22 }}>
              <Button size="small" onClick={checkFfmpeg}>確認</Button>
            </Col>
          </Row>
          {ffmpegVersion && <Text style={{ color: '#52c41a', fontSize: 11 }}>✓ {ffmpegVersion}</Text>}

          <Row gutter={8} align="middle">
            <Col flex={1}>
              <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>yt-dlp 路徑</Text>
              <Input
                value={ytdlpPath}
                onChange={(e) => setYtdlpPath(e.target.value)}
                placeholder="(使用嵌入版本)"
                style={{ fontSize: 12 }}
              />
            </Col>
            <Col style={{ paddingTop: 22 }}>
              <Button size="small" onClick={checkYtdlp}>確認</Button>
            </Col>
          </Row>
          {ytdlpVersion && <Text style={{ color: '#52c41a', fontSize: 11 }}>✓ {ytdlpVersion}</Text>}
        </Space>
      </div>

      <Divider style={{ borderColor: '#222' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#444', fontSize: 11 }}>FlimCutter v0.1.0 — Tauri v2 + React + Rust</Text>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          danger
          onClick={() => {
            resetSettings();
            message.success('已恢復預設值');
          }}
        >
          恢復預設值
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
