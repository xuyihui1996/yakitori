/**
 * 菜单 OCR API 服务
 * 
 * 注意：由于 Google Vision API 需要服务端调用（不能在前端直接调用），
 * 这个服务需要在一个 Node.js 后端 API 中实现。
 * 
 * 使用方式：
 * 1. 在 Vercel 或其他支持 Serverless Functions 的平台创建 API 端点
 * 2. 或创建一个独立的 Node.js 后端服务
 * 
 * 前端调用示例：
 * ```typescript
 * const formData = new FormData();
 * formData.append('image', file);
 * 
 * const response = await fetch('/api/parse-menu', {
 *   method: 'POST',
 *   body: formData,
 * });
 * 
 * const items = await response.json();
 * ```
 */

import type { DetectedMenuItem } from '../types/ocr';

/**
 * 调用后端 API 解析菜单图片
 * 
 * @param file - 图片文件
 * @returns 识别到的菜单项列表
 */
export async function parseMenuImage(file: File): Promise<DetectedMenuItem[]> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/parse-menu', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const items: DetectedMenuItem[] = await response.json();
    return items;
  } catch (error) {
    console.error('OCR API 调用失败:', error);
    throw error;
  }
}

/**
 * 从 Base64 字符串解析菜单图片
 * 
 * @param base64 - Base64 编码的图片字符串（可以包含 data:image/...;base64, 前缀）
 * @returns 识别到的菜单项列表
 */
export async function parseMenuImageFromBase64(base64: string): Promise<DetectedMenuItem[]> {
  // 移除 data:image/...;base64, 前缀（如果有）
  const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '');

  try {
    const response = await fetch('/api/parse-menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Data }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const items: DetectedMenuItem[] = await response.json();
    return items;
  } catch (error) {
    console.error('OCR API 调用失败:', error);
    throw error;
  }
}

/**
 * 测试 OCR 功能（使用本地图片 URL）
 * 
 * @param imageUrl - 图片 URL
 * @returns 识别到的菜单项列表
 */
export async function parseMenuImageFromUrl(imageUrl: string): Promise<DetectedMenuItem[]> {
  try {
    const response = await fetch('/api/parse-menu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    const items: DetectedMenuItem[] = await response.json();
    return items;
  } catch (error) {
    console.error('OCR API 调用失败:', error);
    throw error;
  }
}



