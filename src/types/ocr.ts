// 简化的 OCR 类型定义
export type OcrInput = 
  | { type: 'buffer'; data: Buffer }
  | { type: 'base64'; data: string }
  | { type: 'url'; data: string };

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrWord {
  text: string;
  bbox: BoundingBox;
  confidence?: number;
}

export interface OcrBlock {
  text: string;
  bbox: BoundingBox;
  words: OcrWord[];
  confidence?: number;
}

export interface OcrPage {
  width: number;
  height: number;
  blocks: OcrBlock[];
}

export interface DetectedMenuItem {
  name: string;
  price?: number;
  rawText: string;
  note?: string;
  bbox?: BoundingBox;
  sourceColumn?: number;
  confidence?: number;
  needsReview: boolean;
}

export interface ParseMenuOptions {
  languageHints?: string[];
  maxColumns?: number;
  pricePatterns?: string[];
  maxColumnGap?: number;
}

export type ColumnType = 'name' | 'price' | 'unknown';

export interface ColumnGroup {
  columnIndex: number;
  type?: ColumnType;
  blocks: OcrBlock[];
  xRange: {
    min: number;
    max: number;
  };
}
