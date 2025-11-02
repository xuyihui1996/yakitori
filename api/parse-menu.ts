/**
 * Vercel Serverless Function: 菜单图片解析 API
 * 
 * 部署位置：/api/parse-menu
 * 
 * 使用方法：
 * 1. 确保已在 Vercel 项目设置中添加环境变量：
 *    - GOOGLE_APPLICATION_CREDENTIALS (JSON 密钥文件的内容，作为环境变量)
 *    或
 *    - 使用 Vercel 的环境变量，直接在代码中读取
 * 
 * 2. 前端调用：
 *    POST /api/parse-menu
 *    Content-Type: multipart/form-data
 *    Body: { image: File }
 * 
 *    或
 * 
 *    POST /api/parse-menu
 *    Content-Type: application/json
 *    Body: { image: base64String } 或 { imageUrl: string }
 * 
 * 3. 返回：
 *    { items: DetectedMenuItem[] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { IncomingForm } from 'formidable';
import fs from 'fs';

// 动态导入解析函数（避免在编译时导入）
async function parseMenuImage(imageData: Buffer | string, isUrl = false) {
  const { parseMenuImageToItems } = await import('../src/parser/index.js');
  const { OcrInput } = await import('../src/types/ocr.js');

  let input;
  if (isUrl) {
    input = { type: 'url', data: imageData as string };
  } else if (typeof imageData === 'string') {
    // Base64 字符串
    input = { type: 'base64', data: imageData };
  } else {
    // Buffer
    input = { type: 'buffer', data: imageData };
  }

  return await parseMenuImageToItems(input as any, {
    languageHints: ['ja'],
    maxColumns: 6,
    maxColumnGap: 8,
  });
}

// 解析 FormData (文件上传)
function parseFormData(req: VercelRequest): Promise<{ fields: any; files: any }> {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
      } else {
        resolve({ fields, files });
      }
    });
  });
}

// 禁用 Vercel 的默认 body parser，让 formidable 处理
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    // 检查环境变量
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      console.error('❌ GOOGLE_APPLICATION_CREDENTIALS not set');
      return res.status(500).json({
        error: 'OCR service not configured',
        message: 'GOOGLE_APPLICATION_CREDENTIALS environment variable is not set',
      });
    }

    console.log('✅ Environment variable set:', credentialsPath ? 'YES' : 'NO');

    let imageData: Buffer | string;
    let isUrl = false;

    // 处理 multipart/form-data (文件上传)
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      console.log('📦 Parsing multipart/form-data...');
      try {
        const { files } = await parseFormData(req);
        console.log('📁 Files received:', Object.keys(files));
        
        // 获取上传的图片文件
        const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
        
        if (!imageFile) {
          console.error('❌ No image file in request');
          return res.status(400).json({
            error: 'No image file uploaded',
            message: 'Please upload an image file with field name "image"',
          });
        }

        console.log('📷 Image file:', imageFile.originalFilename, imageFile.size, 'bytes');
        
        // 读取文件内容
        imageData = fs.readFileSync(imageFile.filepath);
        console.log('✅ Image data loaded:', imageData.length, 'bytes');
        
        // 清理临时文件
        fs.unlinkSync(imageFile.filepath);
        console.log('🧹 Temp file cleaned');
      } catch (err) {
        console.error('❌ Form data parsing error:', err);
        return res.status(400).json({
          error: 'Failed to parse form data',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // 处理 JSON 请求（base64 或 URL）
    if (req.headers['content-type']?.includes('application/json')) {
      const body = req.body;
      
      if (body.imageUrl) {
        imageData = body.imageUrl;
        isUrl = true;
      } else if (body.image) {
        // Base64 字符串（移除前缀）
        imageData = body.image.replace(/^data:image\/[a-z]+;base64,/, '');
      } else {
        return res.status(400).json({
          error: 'Invalid request body',
          message: 'Expected { image: base64String } or { imageUrl: string }',
        });
      }
    } else {
      return res.status(400).json({
        error: 'Invalid content type',
        message: 'Expected multipart/form-data or application/json',
      });
    }

    // 如果是 Base64，转换为 Buffer
    if (typeof imageData === 'string' && !isUrl) {
      imageData = Buffer.from(imageData, 'base64');
    }

    // 调用 OCR
    console.log('🤖 Starting OCR processing...');
    const items = await parseMenuImage(imageData, isUrl);
    console.log('✅ OCR completed:', items.length, 'items found');

    return res.status(200).json({ items });
  } catch (error) {
    console.error('❌ OCR API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error('Error details:', errorMessage);
    console.error('Stack trace:', errorStack);
    
    return res.status(500).json({
      error: 'OCR processing failed',
      message: errorMessage,
    });
  }
}

