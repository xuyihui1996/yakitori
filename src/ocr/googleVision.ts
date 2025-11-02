import { ImageAnnotatorClient } from '@google-cloud/vision';
import type { OcrInput } from '../types/ocr';

let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath) {
      visionClient = new ImageAnnotatorClient({
        keyFilename: credentialsPath,
      });
    } else {
      visionClient = new ImageAnnotatorClient();
    }
  }
  return visionClient;
}

function prepareImage(input: OcrInput): any {
  if (input.type === 'buffer') {
    return { content: input.data };
  } else if (input.type === 'base64') {
    return { content: Buffer.from(input.data, 'base64') };
  } else if (input.type === 'url') {
    return { source: { imageUri: input.data } };
  }
  throw new Error('Invalid OcrInput type');
}

export interface GoogleVisionResponse {
  fullTextAnnotation?: any;
  textAnnotations?: any[];
}

export async function runOcrOnImage(
  input: OcrInput,
  languageHints: string[] = ['ja']
): Promise<GoogleVisionResponse> {
  try {
    const client = getVisionClient();
    const image = prepareImage(input);
    const [result] = await client.documentTextDetection({
      image,
      imageContext: {
        languageHints,
      },
    });
    const response: GoogleVisionResponse = {
      fullTextAnnotation: result.fullTextAnnotation as any,
      textAnnotations: result.textAnnotations as any,
    };
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`OCR request failed: ${errorMessage}`);
  }
}
