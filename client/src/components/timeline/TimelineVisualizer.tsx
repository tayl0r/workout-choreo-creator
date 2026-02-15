import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { fetchSong, getSongAudioUrl } from '../../services/api';
import { useAppStore } from '../../stores/appStore';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function filterBass(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 150;
  lowpass.Q.value = 0.7;

  source.connect(lowpass);
  lowpass.connect(offlineCtx.destination);
  source.start(0);

  return offlineCtx.startRendering();
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

interface TimelineVisualizerProps {
  songId: number;
}

function TimelineVisualizer({ songId }: TimelineVisualizerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const bassWaveformRef = useRef<HTMLDivElement>(null);
  const bassWsRef = useRef<WaveSurfer | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beats, setBeats] = useState<number[]>([]);
  const [zoom, setZoom] = useState(1);

  const { isPlaying, setIsPlaying } = useAppStore();

  // Fetch song metadata (beats)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const song = await fetchSong(songId);
        if (!cancelled && song.beats) {
          setBeats(song.beats);
        }
      } catch {
        // Beat data is optional, don't fail on this
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [songId]);

  // Create WaveSurfer instance
  useEffect(() => {
    if (!waveformRef.current) return;

    setLoading(true);
    setError(null);
    setIsReady(false);
    setCurrentTime(0);
    setDuration(0);
    setBeats([]);

    const regions = RegionsPlugin.create();

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#335566',
      progressColor: '#00d4aa',
      cursorColor: '#00d4aa',
      cursorWidth: 2,
      height: 128,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      url: getSongAudioUrl(songId),
      backend: 'WebAudio',
      plugins: [regions],
    });

    wavesurferRef.current = ws;
    regionsRef.current = regions;

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setIsReady(true);
      setLoading(false);
    });

    ws.on('timeupdate', (time: number) => {
      setCurrentTime(time);
      // Sync bass waveform cursor
      if (bassWsRef.current) {
        const dur = ws.getDuration();
        if (dur > 0) {
          bassWsRef.current.seekTo(time / dur);
        }
      }
    });

    ws.on('play', () => {
      setIsPlaying(true);
    });

    ws.on('pause', () => {
      setIsPlaying(false);
    });

    ws.on('finish', () => {
      setIsPlaying(false);
    });

    ws.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to load audio: ${message}`);
      setLoading(false);
    });

    ws.on('decode', async () => {
      const decodedData = ws.getDecodedData();
      if (!decodedData || !bassWaveformRef.current) return;

      try {
        const bassBuffer = await filterBass(decodedData);

        // Guard against stale decode if song changed during filtering
        if (wavesurferRef.current !== ws) return;

        const wavBlob = audioBufferToWav(bassBuffer);

        // Destroy previous bass instance if exists
        if (bassWsRef.current) {
          bassWsRef.current.destroy();
        }

        const bassWs = WaveSurfer.create({
          container: bassWaveformRef.current,
          waveColor: '#886633',
          progressColor: '#dd8833',
          cursorColor: '#dd8833',
          cursorWidth: 2,
          height: 80,
          barWidth: 2,
          barGap: 1,
          barRadius: 1,
          normalize: true,
          interact: true,
        });

        bassWs.loadBlob(wavBlob);

        // Clicking bass waveform seeks the main player
        bassWs.on('interaction', (newTime: number) => {
          if (wavesurferRef.current) {
            const bassDuration = bassWs.getDuration();
            if (bassDuration > 0) {
              wavesurferRef.current.seekTo(newTime / bassDuration);
            }
          }
        });

        bassWsRef.current = bassWs;
      } catch (err) {
        console.warn('Bass filter failed:', err);
      }
    });

    return () => {
      if (bassWsRef.current) {
        bassWsRef.current.destroy();
        bassWsRef.current = null;
      }
      ws.stop();
      ws.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
    };
  }, [songId, setIsPlaying]);

  // Apply zoom
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.zoom(zoom * 50);
    }
    if (bassWsRef.current && isReady) {
      bassWsRef.current.zoom(zoom * 50);
    }
  }, [zoom, isReady]);

  // Sync scroll position between main and bass waveforms
  useEffect(() => {
    if (!isReady) return;
    const mainContainer = waveformRef.current;
    const bassContainer = bassWaveformRef.current;
    if (!mainContainer || !bassContainer) return;

    const mainScrollable = mainContainer.querySelector('div > div') as HTMLElement | null;
    const bassScrollable = bassContainer.querySelector('div > div') as HTMLElement | null;
    if (!mainScrollable || !bassScrollable) return;

    const syncScroll = () => {
      bassScrollable.scrollLeft = mainScrollable.scrollLeft;
    };
    mainScrollable.addEventListener('scroll', syncScroll);
    return () => mainScrollable.removeEventListener('scroll', syncScroll);
  }, [isReady, zoom]);

  // Draw beat markers via Regions plugin
  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !isReady || duration <= 0 || beats.length === 0) return;

    regions.clearRegions();

    beats.forEach((beatTime, i) => {
      if (i % 2 !== 0) return;
      if (beatTime < 0 || beatTime > duration) return;
      regions.addRegion({
        start: beatTime,
        end: beatTime,
        color: 'rgba(0, 212, 170, 0.4)',
        drag: false,
        resize: false,
      });
    });
  }, [beats, duration, isReady]);

  const handlePlayPause = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.playPause();
  }, [isReady]);

  const handleStop = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.stop();
  }, [isReady]);

  const handleSkipBack = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return;
    const newTime = Math.max(0, wavesurferRef.current.getCurrentTime() - 5);
    wavesurferRef.current.seekTo(newTime / wavesurferRef.current.getDuration());
  }, [isReady]);

  const handleSkipForward = useCallback(() => {
    if (!wavesurferRef.current || !isReady) return;
    const dur = wavesurferRef.current.getDuration();
    const newTime = Math.min(dur, wavesurferRef.current.getCurrentTime() + 5);
    wavesurferRef.current.seekTo(newTime / dur);
  }, [isReady]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z * 1.5, 20));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z / 1.5, 0.5));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  // Expose play/pause to the global spacebar handler
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__choreoPlayPause = handlePlayPause;
    return () => {
      delete (window as unknown as Record<string, unknown>).__choreoPlayPause;
    };
  }, [handlePlayPause]);

  return (
    <div style={{ background: 'var(--bg-secondary)' }}>
      {/* Waveform */}
      <div className="relative" style={{ height: 128 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex items-center gap-2">
              <div
                className="animate-spin rounded-full h-5 w-5"
                style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Loading waveform...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="text-sm" style={{ color: 'var(--danger)' }}>
              {error}
            </span>
          </div>
        )}

        <div ref={waveformRef} className="w-full h-full" style={{ background: 'var(--bg-primary)' }} />
      </div>

      {/* Bass waveform */}
      <div className="relative" style={{ height: 80, borderTop: '1px solid var(--border)' }}>
        <div
          className="absolute top-1 left-2 text-[10px] font-mono uppercase z-10 pointer-events-none"
          style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
        >
          bass
        </div>
        <div ref={bassWaveformRef} className="w-full h-full" style={{ background: 'var(--bg-primary)' }} />
      </div>

      {/* Transport controls */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {/* Left: transport buttons */}
        <div className="flex items-center gap-1">
          <TransportButton onClick={handleSkipBack} title="Skip back 5s" disabled={!isReady}>
            {'\u23EA'}
          </TransportButton>
          <TransportButton onClick={handleStop} title="Stop" disabled={!isReady}>
            {'\u23F9'}
          </TransportButton>
          <TransportButton
            onClick={handlePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            disabled={!isReady}
            accent
          >
            {isPlaying ? '\u23F8' : '\u25B6'}
          </TransportButton>
          <TransportButton onClick={handleSkipForward} title="Skip forward 5s" disabled={!isReady}>
            {'\u23E9'}
          </TransportButton>
        </div>

        {/* Center: time display */}
        <div
          className="text-sm font-mono tabular-nums"
          style={{ color: 'var(--text-primary)' }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Right: zoom controls */}
        <div className="flex items-center gap-1">
          <TransportButton onClick={handleZoomOut} title="Zoom out" disabled={!isReady}>
            -
          </TransportButton>
          <button
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs rounded cursor-pointer border-none outline-none transition-colors duration-150"
            style={{
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <TransportButton onClick={handleZoomIn} title="Zoom in" disabled={!isReady}>
            +
          </TransportButton>
        </div>
      </div>
    </div>
  );
}

function TransportButton({
  children,
  onClick,
  title,
  disabled = false,
  accent = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded cursor-pointer border-none outline-none transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
      style={{
        background: accent ? 'var(--accent)' : 'var(--bg-tertiary)',
        color: accent ? 'var(--bg-primary)' : 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        if (!e.currentTarget.disabled) {
          if (accent) {
            e.currentTarget.style.background = 'var(--accent-hover)';
          } else {
            e.currentTarget.style.background = 'var(--bg-hover)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (accent) {
          e.currentTarget.style.background = 'var(--accent)';
        } else {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
        }
      }}
    >
      {children}
    </button>
  );
}

export default TimelineVisualizer;
