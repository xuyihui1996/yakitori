/**
 * 图片预处理工具
 * 在送给 Vision API 之前进行预处理
 */

import sharp from 'sharp';

/**
 * 图片方向
 */
export enum ImageOrientation {
  /** 横向（宽 > 高） */
  LANDSCAPE = 'landscape',
  /** 竖向（高 > 宽） */
  PORTRAIT = 'portrait',
}

/**
 * 检测图片方向
 */
export async function detectImageOrientation(imageBuffer: Buffer): Promise<{
  orientation: ImageOrientation;
  width: number;
  height: number;
}> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  return {
    orientation: width > height ? ImageOrientation.LANDSCAPE : ImageOrientation.PORTRAIT,
    width,
    height,
  };
}

/**
 * 自动旋转图片，使其适合竖排文字识别
 * 
 * **策略**：
 * - 如果是横向照片（宽 > 高），旋转 90° 使其变成竖向
 * - 这样 Vision API 会把竖排文字识别得更准确
 * 
 * @param imageBuffer - 原始图片
 * @param forceRotate - 强制旋转（即使已经是竖向）
 * @returns 旋转后的图片和元数据
 */
export async function autoRotateForVerticalText(
  imageBuffer: Buffer,
  options: {
    forceRotate?: boolean;
    rotationAngle?: 90 | -90 | 180 | 270;
  } = {}
): Promise<{
  buffer: Buffer;
  rotated: boolean;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
}> {
  const { forceRotate = false, rotationAngle = -90 } = options;

  const metadata = await sharp(imageBuffer).metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  const isLandscape = originalWidth > originalHeight;

  if (isLandscape || forceRotate) {
    console.log(`🔄 旋转图片: ${originalWidth}x${originalHeight} → ${rotationAngle}°`);

    const rotatedBuffer = await sharp(imageBuffer)
      .rotate(rotationAngle)
      .toBuffer();

    const rotatedMeta = await sharp(rotatedBuffer).metadata();

    return {
      buffer: rotatedBuffer,
      rotated: true,
      originalWidth,
      originalHeight,
      newWidth: rotatedMeta.width || 0,
      newHeight: rotatedMeta.height || 0,
    };
  }

  return {
    buffer: imageBuffer,
    rotated: false,
    originalWidth,
    originalHeight,
    newWidth: originalWidth,
    newHeight: originalHeight,
  };
}

/**
 * 增强图片质量（可选）
 * 
 * 对于低质量的照片，可以：
 * - 提高对比度
 * - 锐化
 * - 调整亮度
 */
export async function enhanceImageForOCR(
  imageBuffer: Buffer,
  options: {
    sharpen?: boolean;
    contrast?: number; // 1.0 = 原始，> 1.0 增强对比度
    brightness?: number; // 1.0 = 原始，> 1.0 增亮
  } = {}
): Promise<Buffer> {
  const { sharpen = true, contrast = 1.2, brightness = 1.0 } = options;

  let pipeline = sharp(imageBuffer);

  // 调整亮度和对比度
  if (contrast !== 1.0 || brightness !== 1.0) {
    pipeline = pipeline.modulate({
      brightness,
      saturation: 1.0,
    }).linear(contrast, -(128 * contrast) + 128);
  }

  // 锐化
  if (sharpen) {
    pipeline = pipeline.sharpen();
  }

  return pipeline.toBuffer();
}

/**
 * 组合预处理：旋转 + 增强
 */
export async function preprocessImageForVerticalMenu(
  imageBuffer: Buffer,
  options: {
    autoRotate?: boolean;
    enhance?: boolean;
    rotationAngle?: 90 | 180 | 270;
  } = {}
): Promise<{
  buffer: Buffer;
  rotated: boolean;
  enhanced: boolean;
  originalSize: { width: number; height: number };
  newSize: { width: number; height: number };
}> {
  const { autoRotate = true, enhance = false, rotationAngle = 90 } = options;

  let processedBuffer = imageBuffer;
  let rotated = false;
  let originalWidth = 0;
  let originalHeight = 0;
  let newWidth = 0;
  let newHeight = 0;

  // 第1步：旋转
  if (autoRotate) {
    const rotateResult = await autoRotateForVerticalText(processedBuffer, { rotationAngle });
    processedBuffer = rotateResult.buffer;
    rotated = rotateResult.rotated;
    originalWidth = rotateResult.originalWidth;
    originalHeight = rotateResult.originalHeight;
    newWidth = rotateResult.newWidth;
    newHeight = rotateResult.newHeight;
  } else {
    const metadata = await sharp(processedBuffer).metadata();
    originalWidth = metadata.width || 0;
    originalHeight = metadata.height || 0;
    newWidth = originalWidth;
    newHeight = originalHeight;
  }

  // 第2步：增强（可选）
  if (enhance) {
    processedBuffer = await enhanceImageForOCR(processedBuffer);
  }

  return {
    buffer: processedBuffer,
    rotated,
    enhanced: enhance,
    originalSize: { width: originalWidth, height: originalHeight },
    newSize: { width: newWidth, height: newHeight },
  };
}

