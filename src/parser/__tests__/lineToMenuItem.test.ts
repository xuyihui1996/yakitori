/**
 * 行解析测试用例
 */

import { parseMenuLine } from '../lineToMenuItem';

describe('parseMenuLine', () => {
  test('应该正确解析普通价格格式', () => {
    const result = parseMenuLine('砂肝　３５０円');
    expect(result.name).toBe('砂肝');
    expect(result.price).toBe(350);
    expect(result.needsReview).toBe(false);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('应该正确解析全角数字+円', () => {
    const result = parseMenuLine('とりなんこつ　４５０円');
    expect(result.name).toBe('とりなんこつ');
    expect(result.price).toBe(450);
    expect(result.needsReview).toBe(false);
  });

  test('应该正确解析汉数字价格', () => {
    const result = parseMenuLine('かしわ　三五〇円');
    expect(result.name).toBe('かしわ');
    expect(result.price).toBe(350);
    expect(result.needsReview).toBe(false);
  });

  test('应该正确解析汉数字价格（五〇〇）', () => {
    const result = parseMenuLine('かわ　五〇〇円');
    expect(result.name).toBe('かわ');
    expect(result.price).toBe(500);
    expect(result.needsReview).toBe(false);
  });

  test('应该正确解析只有数字的价格', () => {
    const result = parseMenuLine('チーズベーコン　４５０');
    expect(result.name).toBe('チーズベーコン');
    expect(result.price).toBe(450);
    expect(result.needsReview).toBe(false);
  });

  test('应该标记无价格的项需要审核', () => {
    const result = parseMenuLine('枝豆');
    expect(result.name).toBe('枝豆');
    expect(result.price).toBeUndefined();
    expect(result.needsReview).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });

  test('应该处理全角数字', () => {
    const result = parseMenuLine('手羽先　５００円');
    expect(result.name).toBe('手羽先');
    expect(result.price).toBe(500);
    expect(result.needsReview).toBe(false);
  });

  test('应该处理混合全角半角数字', () => {
    const result = parseMenuLine('つくね　４５0円');
    expect(result.name).toBe('つくね');
    expect(result.price).toBe(450);
    expect(result.needsReview).toBe(false);
  });

  test('应该处理汉数字八〇〇', () => {
    const result = parseMenuLine('やげん软骨　八〇〇円');
    expect(result.name).toBe('やげん软骨');
    expect(result.price).toBe(800);
    expect(result.needsReview).toBe(false);
  });

  test('应该处理短菜名', () => {
    const result = parseMenuLine('豆　３５０円');
    // 短菜名可能标记为需要审核（根据实际需求调整阈值）
    expect(result.price).toBe(350);
  });

  test('应该处理空字符串', () => {
    const result = parseMenuLine('');
    expect(result.name).toBe('');
    expect(result.price).toBeUndefined();
    expect(result.needsReview).toBe(true);
  });

  test('应该保留空格', () => {
    const result = parseMenuLine('  かしわ　三五〇円  ');
    expect(result.name.trim()).toBe('かしわ');
    expect(result.price).toBe(350);
  });
});



