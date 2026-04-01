import React, { useRef, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useVideoStore } from '../../stores/videoStore';

interface VideoPlayerProps {
  filePath: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ filePath }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const setCurrentTime = useVideoStore((s) => s.setCurrentTime);
  const setDuration = useVideoStore((s) => s.setDuration);
  const setIsPlaying = useVideoStore((s) => s.setIsPlaying);
  const storeTime = useVideoStore((s) => s.currentTime);

  const src = convertFileSrc(filePath);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.src = src;
    el.load();
  }, [src]);

  // Seek video when timeline drags the playhead
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (Math.abs(el.currentTime - storeTime) > 0.5) {
      el.currentTime = storeTime;
    }
  }, [storeTime]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <video
        ref={videoRef}
        controls
        style={{ maxWidth: '100%', maxHeight: '100%', outline: 'none' }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => console.error('[VideoPlayer] error', e.currentTarget.error)}
      />
    </div>
  );
};

export default VideoPlayer;
