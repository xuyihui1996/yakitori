/**
 * 名字和价格匹配测试
 */

import { matchNameAndPrice } from '../matchNameAndPrice';
import type { OcrBlock } from '../../types/ocr';

describe('matchNameAndPrice', () => {
  test('应该根据 Y 坐标匹配最近的价格', () => {
    const names: OcrBlock[] = [
      {
        text: 'かしわ',
        bbox: { x: 100, y: 100, width: 20, height: 80 },
        words: [],
      },
    ];

    const prices: OcrBlock[] = [
      {
        text: '一 二 〇 円',
        bbox: { x: 150, y: 110, width: 20, height: 70 },
        words: [],
      },
    ];

    const items = matchNameAndPrice(names, prices);

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('かしわ');
    expect(items[0].price).toBe(120);
    expect(items[0].rawText).toContain('かしわ');
    expect(items[0].rawText).toContain('一 二 〇 円');
    expect(items[0].needsReview).toBe(false);
  });

  test('应该选择 Y 坐标最近的价格', () => {
    const names: OcrBlock[] = [
      {
        text: 'かしわ',
        bbox: { x: 100, y: 100, width: 20, height: 80 },
        words: [],
      },
    ];

    const prices: OcrBlock[] = [
      {
        text: '三 00 円',
        bbox: { x: 150, y: 50, width: 20, height: 70 },
        words: [],
      },
      {
        text: '一 二 〇 円',
        bbox: { x: 150, y: 110, width: 20, height: 70 },
        words: [],
      },
    ];

    const items = matchNameAndPrice(names, prices);

    expect(items[0].price).toBe(120); // 选择更近的那个
  });

  test('没有价格时应该标记为需要审核', () => {
    const names: OcrBlock[] = [
      {
        text: 'かしわ',
        bbox: { x: 100, y: 100, width: 20, height: 80 },
        words: [],
      },
    ];

    const prices: OcrBlock[] = [];

    const items = matchNameAndPrice(names, prices);

    expect(items[0].name).toBe('かしわ');
    expect(items[0].price).toBeUndefined();
    expect(items[0].needsReview).toBe(true);
  });

  test('距离太远时应该不匹配', () => {
    const names: OcrBlock[] = [
      {
        text: 'かしわ',
        bbox: { x: 100, y: 100, width: 20, height: 80 },
        words: [],
      },
    ];

    const prices: OcrBlock[] = [
      {
        text: '一 二 〇 円',
        bbox: { x: 150, y: 500, width: 20, height: 70 }, // 距离很远
        words: [],
      },
    ];

    const items = matchNameAndPrice(names, prices, 50); // 最大距离 50px

    expect(items[0].price).toBeUndefined();
    expect(items[0].needsReview).toBe(true);
  });
});


