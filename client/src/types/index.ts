export interface Song {
  id: number;
  name: string;
  duration: number;
  bpm: number | null;
  beats?: number[];
  filepath: string;
  youtube_url?: string;
  created_at: string;
}

export interface YouTubeResult {
  id: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  url: string;
  view_count: number;
  like_count: number;
  channel_follower_count: number;
}

export interface MoveEntry {
  id: string;
  name: string;
  raw: string;
}

export type ActiveComponent = 'songs' | 'song-designer' | 'part-designer' | 'sequences' | 'moves' | 'debug';
