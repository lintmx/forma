import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { loadFonts } from '../src/core/fonts.js';
import { ImageStore } from '../src/core/images.js';
import { Renderer } from '../src/core/renderer.js';
import { createTemplateRegistry } from '../src/templates/index.js';
import { youtube } from '../src/templates/youtube/index.js';
import {
  broadcastState,
  durationSeconds,
  formatCount,
  formatSeconds,
  formatTime,
} from '../src/templates/youtube/presentation.js';
import { type YoutubeData, youtubeSchema } from '../src/templates/youtube/schema.js';

let renderer: Renderer;
const context = { assets: {}, fontFamily: 'sans-serif', monospaceFontFamily: 'monospace' };
const upcoming: YoutubeData = {
  id: 'aqz-KE-bpKQ',
  snippet: {
    title: '一起创造电影世界｜Blender Live / オープン制作室',
    channelTitle: 'Blender Studio',
    liveBroadcastContent: 'upcoming',
    publishedAt: '2026-10-20T08:00:00Z',
    thumbnails: { maxres: { url: 'https://example.com/cover.png' } },
    description:
      '从故事板到最终渲染，一起探索开源动画的创作过程。\nLive workshop / 制作の裏側 🎬\nhttps://www.blender.org',
  },
  liveStreamingDetails: { scheduledStartTime: '2026-10-22T12:00:00Z', scheduledEndTime: '2026-10-22T14:00:00Z' },
  contentDetails: { duration: 'PT0S' },
  statistics: { viewCount: '0', likeCount: '1200' },
  observedAt: '2026-10-22T11:00:00Z',
};
const live: YoutubeData = {
  ...upcoming,
  snippet: { ...upcoming.snippet, liveBroadcastContent: 'live' },
  liveStreamingDetails: {
    ...upcoming.liveStreamingDetails,
    actualStartTime: '2026-10-22T12:02:00Z',
    concurrentViewers: '18420',
  },
  observedAt: '2026-10-22T13:15:00Z',
};
const ended: YoutubeData = {
  ...live,
  snippet: { ...live.snippet, liveBroadcastContent: 'none' },
  liveStreamingDetails: { ...live.liveStreamingDetails, actualEndTime: '2026-10-22T13:34:00Z' },
  contentDetails: { duration: 'PT1H32M' },
  statistics: { viewCount: '42100', likeCount: '3200', commentCount: '154' },
};
const scheduled: YoutubeData = {
  ...youtube.mock,
  status: { privacyStatus: 'private', publishAt: '2026-10-25T12:00:00Z' },
};
const cases: [string, YoutubeData][] = [
  ['published', youtube.mock],
  ['scheduled', scheduled],
  ['upcoming', upcoming],
  ['delayed', { ...upcoming, observedAt: '2026-10-22T12:10:00Z' }],
  ['unscheduled', { ...upcoming, liveStreamingDetails: {} }],
  ['live', live],
  ['ended', ended],
  ['replay', { ...ended, replayAvailable: true }],
];

beforeAll(async () => {
  const config = loadConfig({ LOG_LEVEL: 'silent' });
  renderer = new Renderer(config, await loadFonts(config.fontConfig), createTemplateRegistry());
  await mkdir('artifacts/youtube', { recursive: true });
});
afterEach(() => vi.restoreAllMocks());

it('accepts selected API fields and rejects invalid timestamps, durations, counts and assets', () => {
  for (const [, data] of cases) expect(youtubeSchema.safeParse(data).success).toBe(true);
  expect(youtubeSchema.safeParse({ snippet: { title: '最简视频' } }).success).toBe(true);
  for (const extra of [
    { snippet: { title: ' ' } },
    { snippet: { title: '标题', liveBroadcastContent: 'replay' } },
    { snippet: { title: '标题', publishedAt: '2026-10-22 20:00' } },
    { snippet: { title: '标题', thumbnails: { high: { url: 'ftp://example.com/image' } } } },
    { status: { publishAt: '2026-10-25 20:00' } },
    { status: { privacyStatus: 'scheduled' } },
    { contentDetails: { duration: '01:20' } },
    { contentDetails: { duration: 'PT' } },
    { statistics: { viewCount: '-1' } },
    { statistics: { likeCount: 1.5 } },
    { statistics: { viewCount: Number.MAX_SAFE_INTEGER + 1 } },
    { timeZone: 'Somewhere/Nowhere' },
    { channelAvatarUrl: 'data:image/svg+xml,unsafe' },
    { watermark: 'legacy' },
  ])
    expect(youtubeSchema.safeParse({ snippet: { title: '标题' }, ...extra }).success).toBe(false);
});

it('distinguishes scheduled videos and four live phases without guessing from wall clock or duration', () => {
  expect(broadcastState(youtube.mock)).toBe('published');
  expect(broadcastState(scheduled)).toBe('scheduled');
  expect(broadcastState({ ...scheduled, observedAt: '2026-10-26T00:00:00Z' })).toBe('scheduled');
  expect(broadcastState({ ...scheduled, status: { ...scheduled.status, privacyStatus: 'public' } })).toBe('published');
  expect(broadcastState({ ...scheduled, status: { ...scheduled.status, privacyStatus: 'unlisted' } })).toBe(
    'published',
  );
  expect(
    broadcastState({ ...youtube.mock, snippet: { title: '未来发布时间', publishedAt: '2099-01-01T00:00:00Z' } }),
  ).toBe('published');
  expect(broadcastState(upcoming)).toBe('upcoming');
  expect(broadcastState({ ...upcoming, observedAt: upcoming.liveStreamingDetails!.scheduledStartTime })).toBe(
    'upcoming',
  );
  expect(broadcastState({ ...upcoming, liveStreamingDetails: {} })).toBe('upcoming');
  expect(broadcastState({ ...upcoming, status: scheduled.status })).toBe('upcoming');
  expect(broadcastState({ ...live, observedAt: '2026-10-23T00:00:00Z' })).toBe('live');
  expect(broadcastState({ ...ended, snippet: live.snippet })).toBe('ended');
  expect(broadcastState({ ...ended, replayAvailable: true })).toBe('replay');
  expect(broadcastState({ ...live, snippet: { title: '不完整的直播快照', liveBroadcastContent: 'none' } })).toBe(
    'unknown',
  );
  expect(broadcastState({ ...upcoming, snippet: { title: '取消或状态未明确', liveBroadcastContent: 'none' } })).toBe(
    'unknown',
  );
});

it('displays the correct time and metrics for each broadcast phase', () => {
  const html = (data: YoutubeData) => renderToStaticMarkup(youtube.render(data, context));
  const timed = html(scheduled);
  expect(timed).toContain('定时发布');
  expect(timed).toContain('预计发布');
  expect(timed).toContain('>2026-10-25</div>');
  expect(timed).toContain('>20:00</div>');
  expect(timed).not.toContain('发布于');
  expect(timed).not.toContain('点赞');
  expect(timed).not.toContain('>9:56</div>');
  const before = html(upcoming);
  expect(before).toContain('预约直播');
  expect(before).toContain('预定开播');
  expect(before).toContain('>2026-10-22</div>');
  expect(before).toContain('>20:00</div>');
  expect(before).not.toContain('播放');
  expect(before).not.toContain('点赞');
  expect(before).not.toContain('发布于');
  expect(before).not.toContain('>0:00</div>');
  const during = html(live);
  expect(during).toContain('>LIVE</div>');
  expect(during).toContain('1.8万 人正在观看');
  expect(during).toContain('实际开播');
  expect(during).toContain('>2026-10-22</div>');
  expect(during).toContain('>20:02</div>');
  expect(during).toContain('已播 1:13:00');
  expect(during.indexOf('实际开播')).toBeLessThan(during.indexOf('从故事板到最终渲染'));
  expect(during).not.toContain('预定开播');
  const noViewers = html({
    ...live,
    liveStreamingDetails: { actualStartTime: live.liveStreamingDetails!.actualStartTime },
  });
  expect(noViewers).not.toContain('人正在观看');
  const after = html(ended);
  expect(after).toContain('直播结束');
  expect(after).toContain('>2026-10-22</div>');
  expect(after).toContain('>21:34</div>');
  expect(after).not.toContain('人正在观看');
  expect(after).not.toContain('已播');
  expect(after).not.toContain('>LIVE</div>');
  expect(after).not.toContain('直播回放');
  const replay = html({ ...ended, replayAvailable: true });
  expect(replay).toContain('直播回放');
  expect(replay).toContain('1:32:00');
  expect(replay).not.toContain('人正在观看');
  const zero = html({ snippet: { title: '零与缺省' }, statistics: { viewCount: '0' } });
  expect(zero).toContain('>0</div>');
  expect(zero).toContain('播放');
  expect(zero).not.toContain('点赞');
  expect(zero).not.toContain('评论');
  const published = html(youtube.mock);
  expect(published).toContain('已发布');
  expect(published).toContain('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  expect(published.indexOf('Blender</div>')).toBeLessThan(published.indexOf('封面加载失败'));
  expect(published.indexOf('封面加载失败')).toBeLessThan(published.indexOf(youtube.mock.snippet.title));
  expect(published).toContain('border-top:0.5px solid #e4e4e7');
  expect(published).not.toContain('<a ');
});

it('formats API counts, ISO durations and explicit time zones', () => {
  expect(formatCount('18420')).toBe('1.8万');
  expect(formatCount('12480000')).toBe('1248万');
  expect(formatCount('18446744073709551615')).not.toContain('NaN');
  expect(formatSeconds(durationSeconds('P1DT2H3M4S'))).toBe('26:03:04');
  expect(formatSeconds(durationSeconds('PT9M56S'))).toBe('9:56');
  expect(durationSeconds('PT0S')).toBe(0);
  expect(formatTime('2026-10-22T20:00:00+08:00', 'UTC')).toBe('2026-10-22 12:00');
});

it('falls back to smaller thumbnails and loads the avatar independently', async () => {
  const get = vi.fn(async (url: string) => {
    if (url !== 'asset:high') throw new Error('Image unavailable');
    return 'loaded-cover';
  });
  const assets = await youtube.assets!(
    {
      snippet: {
        title: '缩略图降级',
        thumbnails: { maxres: { url: 'asset:maxres' }, high: { url: 'asset:high' }, default: { url: 'asset:default' } },
      },
      channelAvatarUrl: 'asset:avatar',
    },
    { get },
  );
  expect(assets).toEqual({ cover: 'loaded-cover', avatar: undefined });
  expect(get.mock.calls.map(([url]) => url)).toEqual(['asset:maxres', 'asset:avatar', 'asset:high']);
  get.mockClear();
  await youtube.assets!({ snippet: { title: '最简视频' } }, { get });
  expect(get).not.toHaveBeenCalled();
});

it('renders every video and live phase as real PNG/SVG at the fixed logical width', async () => {
  const image = new PNG({ width: 320, height: 180 });
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++)
      image.data.set([30 + Math.floor(x / 4), 50 + Math.floor(y / 3), 120, 255], (y * image.width + x) * 4);
  }
  const uri = 'data:image/png;base64,' + PNG.sync.write(image).toString('base64');
  vi.spyOn(ImageStore.prototype, 'get').mockResolvedValue(uri);
  for (const [name, data] of cases) {
    const png = await renderer.render({ template: 'youtube', data, format: 'png', watermark: 'Generated by Forma' });
    const svg = await renderer.render({ template: 'youtube', data, format: 'svg', watermark: 'Generated by Forma' });
    expect(png.width).toBe(1200);
    expect(svg.width).toBe(600);
    expect(png.height).toBe(svg.height * 2);
    expect(png.warnings).toEqual([]);
    expect(svg.warnings).toEqual([]);
    const pixels = PNG.sync.read(Buffer.from(png.body));
    let coverPixels = 0;
    let redPixels = 0;
    for (let i = 0; i < pixels.data.length; i += 4) {
      if (pixels.data[i + 2] === 120 && pixels.data[i]! < 120) coverPixels++;
      if (pixels.data[i]! > 250 && pixels.data[i + 1]! < 5 && pixels.data[i + 2]! < 5) redPixels++;
    }
    expect(coverPixels).toBeGreaterThan(250000);
    if (name === 'live') expect(redPixels).toBeGreaterThan(500);
    expect(Buffer.from(svg.body).toString()).toContain('data:image/png;base64,');
    await writeFile(`artifacts/youtube/${name}.png`, png.body);
    await writeFile(`artifacts/youtube/${name}.svg`, svg.body);
  }
});

it('limits channel names to one line and titles to two lines, including emoji', async () => {
  for (const line of ['中文 日本語 English', '中文 🎬 👩🏽‍💻 🇨🇳 🫪']) {
    const heights = [];
    for (const lines of [1, 2, 3, 8]) {
      const data = { snippet: { title: Array(lines).fill(line).join('\n'), channelTitle: '频道 🎬' } };
      const svg = await renderer.render({ template: 'youtube', data, format: 'svg' });
      expect(svg.warnings).toEqual([]);
      heights.push(svg.height);
      if (lines === 3) {
        const png = await renderer.render({ template: 'youtube', data, format: 'png' });
        expect(png.height).toBe(svg.height * 2);
        const longChannel = await renderer.render({
          template: 'youtube',
          format: 'png',
          data: { snippet: { ...data.snippet, channelTitle: '频道 🎬 LongName '.repeat(10) } },
        });
        expect(longChannel.height).toBe(png.height);
        expect(longChannel.warnings).toEqual([]);
        await writeFile(`artifacts/youtube/clamped-${line.includes('🎬') ? 'emoji' : 'text'}.png`, longChannel.body);
      }
    }
    expect(heights[1]).toBeGreaterThan(heights[0]!);
    expect(heights[2]).toBe(heights[1]);
    expect(heights[3]).toBe(heights[1]);
  }
});

it('renders long multilingual content, missing images and minimal input, and bounds the description', async () => {
  vi.spyOn(ImageStore.prototype, 'get').mockRejectedValue(new Error('Image unavailable'));
  const minimal = await renderer.render({
    template: 'youtube',
    format: 'png',
    data: { snippet: { title: '精简卡片' } },
  });
  expect(minimal.warnings).toEqual([]);
  const long = await renderer.render({
    template: 'youtube',
    format: 'png',
    data: {
      ...live,
      channelAvatarUrl: 'https://example.com/missing.png',
      snippet: {
        ...live.snippet,
        title: '中文 日本語 한국어 English 🎬 '.repeat(8),
        channelTitle: 'LongChannelName'.repeat(8),
        description: '中文 日本語 한국어 English https://example.com/long-path 🎬 '.repeat(60),
      },
    },
  });
  expect(long.height).toBeGreaterThan(minimal.height + 400);
  expect(long.width).toBe(1200);
  expect(long.warnings).toEqual(['IMAGE_UNAVAILABLE']);
  await writeFile('artifacts/youtube/minimal.png', minimal.body);
  await writeFile('artifacts/youtube/long-missing.png', long.body);
  const heights = [];
  for (const lines of [10, 11, 30]) {
    const result = await renderer.render({
      template: 'youtube',
      format: 'svg',
      data: { snippet: { title: '简介折叠', description: '中文 English https://example.com\n'.repeat(lines) } },
    });
    expect(Buffer.from(result.body).toString()).toContain('#0969da');
    heights.push(result.height);
  }
  expect(heights[1]).toBeGreaterThan(heights[0]!);
  expect(heights[2]).toBe(heights[1]);
});
