/**
 * 二维码工具函数
 */

import QRCode from 'qrcode';

/**
 * 生成二维码图片（Data URL）
 * @param text 要编码的文本
 * @returns Promise<string> 图片的 Data URL
 */
export async function generateQRCodeDataURL(text: string): Promise<string> {
  try {
    const dataURL = await QRCode.toDataURL(text, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return dataURL;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw error;
  }
}

/**
 * 生成加入群的链接
 * @param groupId 组ID
 * @param baseUrl 基础URL（可选，默认使用当前域名）
 * @returns 完整链接
 */
export function generateJoinLink(groupId: string, baseUrl?: string): string {
  const url = baseUrl || window.location.origin;
  return `${url}/?groupId=${groupId}`;
}

