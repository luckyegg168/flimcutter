import React, { useRef, useEffect } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useVideoStore } from '../../stores/videoStore';

interface VideoPlayerProps {
  filePath: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ filePath }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const setCurrentTime = useVideoStore((s) => s.setCurrentTime);
  const setDuration = useVideoStore((s) => s.setDuration);
  const setIsPlaying = useVideoStore((s) => s.setIsPlaying);

  const playerOptions: Parameters<typeof videojs>[1] = {
    controls: true,
    responsive: true,
    fluid: true,
    preload: 'metadata',
    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
  };

  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(videoRef.current, playerOptions, () => {
      const src = convertFileSrc(filePath);
      player.src({ src, type: detectMimeType(filePath) });
    });

    player.on('timeupdate', () => setCurrentTime(player.currentTime() ?? 0));
    player.on('durationchange', () => setDuration(player.duration() ?? 0));
    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('ended', () => setIsPlaying(false));

    playerRef.current = player;

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  // Update src when filePath changes without recreating player
  useEffect(() => {
    if (playerRef.current && !playerRef.current.isDisposed()) {
      const src = convertFileSrc(filePath);
      playerRef.current.src({ src, type: detectMimeType(filePath) });
      playerRef.current.load();
    }
  }, [filePath]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div data-vjs-player style={{ width: '100%', maxHeight: '100%' }}>
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-theme-dark"
          playsInline
        />
      </div>
    </div>
  );
};

function detectMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    avi: 'video/avi',
    mov: 'video/quicktime',
    flv: 'video/x-flv',
    wmv: 'video/x-ms-wmv',
    ts: 'video/mp2t',
    mts: 'video/mp2t',
    '3gp': 'video/3gpp',
  };
  return map[ext] ?? 'video/mp4';
}

export default VideoPlayer;
