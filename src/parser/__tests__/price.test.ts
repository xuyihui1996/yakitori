/**
 * 价格识别测试
 */

import { parsePriceFromRaw, normalizePriceText, normalizeName } from '../price';

describe('normalizePriceText', () => {
  test('应该去掉空格和装饰符号', () => {
    expect(normalizePriceText('一 二 〇 円')).toBe('一二〇円');
    expect(normalizePriceText('三・00・円')).toBe('三00円');
    expect(normalizePriceText('四　五　〇　円')).toBe('四五〇円');
  });
});

describe('parsePriceFromRaw', () => {
  test('应该识别竖排日文数字价格', () => {
    expect(parsePriceFromRaw('一 二 〇 円')).toBe(120);
    expect(parsePriceFromRaw('二五〇円')).toBe(250);
    expect(parsePriceFromRaw('四 五 〇 円')).toBe(450);
    expect(parsePriceFromRaw('五〇〇円')).toBe(500);
  });

  test('应该识别混合格式价格', () => {
    expect(parsePriceFromRaw('三 00 円')).toBe(300);
    expect(parsePriceFromRaw('四50円')).toBe(450);
    expect(parsePriceFromRaw('五00円')).toBe(500);
  });

  test('应该识别阿拉伯数字价格', () => {
    expect(parsePriceFromRaw('６５０円')).toBe(650);
    expect(parsePriceFromRaw('120円')).toBe(120);
    expect(parsePriceFromRaw('350')).toBe(350);
  });

  test('应该处理全角数字', () => {
    expect(parsePriceFromRaw('１２０円')).toBe(120);
    expect(parsePriceFromRaw('３５０円')).toBe(350);
  });

  test('无法识别的格式应该返回 undefined', () => {
    expect(parsePriceFromRaw('かしわ')).toBeUndefined();
    expect(parsePriceFromRaw('串焼')).toBeUndefined();
    expect(parsePriceFromRaw('※')).toBeUndefined();
  });
});

describe('normalizeName', () => {
  test('应该去掉前后空格', () => {
    expect(normalizeName('  かしわ  ')).toBe('かしわ');
  });

  test('应该去掉装饰符号', () => {
    expect(normalizeName('・かしわ')).toBe('かしわ');
    expect(normalizeName('かしわ・')).toBe('かしわ');
  });

  test('应该保留中间的空格', () => {
    expect(normalizeName('ささみ 梅・わさび')).toBe('ささみ 梅・わさび');
  });
});


