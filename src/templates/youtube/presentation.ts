import type { YoutubeData } from './schema.js';

export function broadcastState(data: YoutubeData) {
  const live = data.liveStreamingDetails;
  if (live?.actualEndTime) return data.replayAvailable ? 'replay' : 'ended';
  if (data.snippet.liveBroadcastContent === 'live') return 'live';
  if (data.snippet.liveBroadcastContent === 'upcoming') return 'upcoming';
  if (live) return 'unknown';
  if (data.status?.publishAt && (!data.status.privacyStatus || data.status.privacyStatus === 'private')) {
    return 'scheduled';
  }
  return 'published';
}

export function formatCount(value: string | number) {
  return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(BigInt(value));
}

export function formatTime(value: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(value))
      .map(part => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return (
    (hours ? hours + ':' + String(minutes).padStart(2, '0') : String(minutes)) +
    ':' +
    String(seconds % 60).padStart(2, '0')
  );
}

export function durationSeconds(value?: string) {
  if (!value) return 0;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  return match
    ? Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0)
    : 0;
}
