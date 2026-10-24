import type { Template } from '../../core/types.js';
import type { ChatData } from './schema.js';

export const chatPresets: NonNullable<Template<ChatData>['presets']> = [
  {
    id: 'short',
    name: '简短对话',
    data: {
      title: '小夏',
      messages: [
        { type: 'text', text: '出发了吗？', sentAt: '14:30' },
        { type: 'text', side: 'right', text: '马上到！', sentAt: '14:31' },
      ],
    },
  },
  {
    id: 'translation',
    name: '双语对话',
    data: {
      title: '旅行交流',
      subtitle: '中文 / 日本語',
      messages: [
        {
          type: 'text',
          name: '小春',
          text: '海辺で夕日を見ましょう。',
          translation: '一起去海边看日落吧。',
          sentAt: '17:00',
        },
        {
          type: 'text',
          side: 'right',
          name: '我',
          text: '好呀，我带上相机。',
          translation: 'いいですね。カメラを持っていきます。',
          sentAt: '17:01',
        },
      ],
    },
  },
  {
    id: 'images',
    name: '图片消息',
    data: {
      title: '风景分享',
      showInput: false,
      messages: [
        {
          type: 'image',
          name: '小夏',
          url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&h=400&q=82',
          alt: '湖边的风景',
          sentAt: '18:30',
        },
        { type: 'text', side: 'right', text: '这张好漂亮！', sentAt: '18:31' },
        { type: 'system', text: '小夏将照片设为群相册封面' },
      ],
    },
  },
  {
    id: 'long',
    name: '长文本与多语言',
    data: {
      title: '旅行计划',
      showInput: false,
      messages: [
        {
          type: 'text',
          name: '小夏',
          text: '明天我们先去车站附近吃早餐，然后沿着海岸慢慢走。记得带上相机和外套，傍晚的海风可能会有一点凉。\nLet’s enjoy the journey, one small moment at a time.\nよい旅を！ 즐거운 여행 되세요! 🌅',
          sentAt: '2026-10-24 18:30',
        },
        { type: 'text', side: 'right', text: '收到，期待明天！' },
      ],
    },
  },
  { id: 'empty', name: '空会话', data: { title: '新的聊天', messages: [] }, watermark: '' },
];
