/**
 * File type detection utilities
 */

export interface FileTypeInfo {
  mimeType: string;
  extension: string;
  description: string;
}

// Common file signatures (magic bytes) - 基于 Go 语言的 magic signatures 映射
const FILE_SIGNATURES: Array<{
  signature: number[];
  mask?: number[];
  offset?: number;
  info: FileTypeInfo;
}> = [
  // 图片格式
  {
    signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
    info: { mimeType: 'image/png', extension: '.png', description: 'PNG image' }
  },
  {
    signature: [0xFF, 0xD8, 0xFF], // JPEG
    info: { mimeType: 'image/jpeg', extension: '.jpg', description: 'JPEG image' }
  },
  {
    signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    info: { mimeType: 'image/gif', extension: '.gif', description: 'GIF image' }
  },
  {
    signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    info: { mimeType: 'image/gif', extension: '.gif', description: 'GIF image' }
  },
  {
    signature: [0x42, 0x4D], // BM
    info: { mimeType: 'image/bmp', extension: '.bmp', description: 'BMP image' }
  },
  {
    signature: [0x49, 0x49, 0x2A, 0x00], // TIFF (little endian)
    info: { mimeType: 'image/tiff', extension: '.tiff', description: 'TIFF (little endian)' }
  },
  {
    signature: [0x4D, 0x4D, 0x00, 0x2A], // TIFF (big endian)
    info: { mimeType: 'image/tiff', extension: '.tiff', description: 'TIFF (big endian)' }
  },

  // 文档格式
  {
    signature: [0x25, 0x50, 0x44, 0x46, 0x2D], // %PDF-
    info: { mimeType: 'application/pdf', extension: '.pdf', description: 'PDF document' }
  },

  // 压缩和归档格式
  {
    signature: [0x50, 0x4B, 0x03, 0x04], // PK.. (ZIP/Office/EPUB)
    info: { mimeType: 'application/zip', extension: '.zip', description: 'ZIP archive / Office Open XML / EPUB' }
  },
  {
    signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], // Rar!\x1a\x07\x00
    info: { mimeType: 'application/x-rar-compressed', extension: '.rar', description: 'RAR archive' }
  },
  {
    signature: [0x1F, 0x8B, 0x08], // GZIP
    info: { mimeType: 'application/gzip', extension: '.gz', description: 'GZIP compressed' }
  },

  // 可执行文件
  {
    signature: [0x4D, 0x5A], // MZ
    info: { mimeType: 'application/x-msdownload', extension: '.exe', description: 'Windows PE executable' }
  },

  // 音频格式
  {
    signature: [0x4F, 0x67, 0x67, 0x53], // OggS
    info: { mimeType: 'audio/ogg', extension: '.ogg', description: 'OGG audio/container' }
  },
  {
    signature: [0x49, 0x44, 0x33], // ID3
    info: { mimeType: 'audio/mpeg', extension: '.mp3', description: 'MP3 audio' }
  },

  // 视频格式
  {
    signature: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70], // ftyp (MP4/MOV)
    info: { mimeType: 'video/mp4', extension: '.mp4', description: 'MP4 / MOV (ftyp) container' }
  },
  {
    signature: [0x52, 0x49, 0x46, 0x46], // RIFF (WAV/AVI/WebP)
    info: { mimeType: 'audio/wav', extension: '.wav', description: 'RIFF (WAV/AVI/WebP)' }
  },

  // 文本格式
  {
    signature: [0x3C, 0x3F, 0x78, 0x6D, 0x6C], // <?xml
    info: { mimeType: 'application/xml', extension: '.xml', description: 'XML' }
  },
  {
    signature: [0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45, 0x20, 0x68, 0x74, 0x6D, 0x6C], // <!DOCTYPE html
    info: { mimeType: 'text/html', extension: '.html', description: 'HTML' }
  },
  {
    signature: [0x7B], // {
    info: { mimeType: 'application/json', extension: '.json', description: 'Likely JSON' }
  },
];

/**
 * Detect file type from binary data using magic bytes
 */
export function detectFileType(buffer: Uint8Array): FileTypeInfo | null {
  for (const { signature, mask, offset = 0, info } of FILE_SIGNATURES) {
    if (buffer.length < offset + signature.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      const bufferByte = buffer[offset + i];
      const signatureByte = signature[i];
      const maskByte = mask ? mask[i] : 0xFF;
      
      if ((bufferByte & maskByte) !== (signatureByte & maskByte)) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // 对于 ZIP 格式，尝试进一步识别具体类型
      if (info.extension === '.zip') {
        const refinedType = refineZipFileType(buffer, info);
        if (refinedType) {
          return refinedType;
        }
      }
      
      // 对于 RIFF 格式，尝试进一步识别具体类型  
      if (info.extension === '.wav' && info.description.includes('RIFF')) {
        const refinedType = refineRiffFileType(buffer, info);
        if (refinedType) {
          return refinedType;
        }
      }
      
      return info;
    }
  }

  return null;
}

/**
 * 进一步识别 ZIP 格式的具体类型（Office文档、EPUB等）
 */
function refineZipFileType(buffer: Uint8Array, defaultInfo: FileTypeInfo): FileTypeInfo | null {
  // 检查是否包含 Office 文档特征
  const bufferStr = Array.from(buffer.slice(0, Math.min(512, buffer.length)))
    .map(b => String.fromCharCode(b))
    .join('');
    
  if (bufferStr.includes('word/')) {
    return { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: '.docx', description: 'Microsoft Word document' };
  }
  if (bufferStr.includes('xl/')) {
    return { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx', description: 'Microsoft Excel spreadsheet' };
  }
  if (bufferStr.includes('ppt/')) {
    return { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: '.pptx', description: 'Microsoft PowerPoint presentation' };
  }
  if (bufferStr.includes('META-INF') && bufferStr.includes('epub')) {
    return { mimeType: 'application/epub+zip', extension: '.epub', description: 'EPUB ebook' };
  }
  
  return defaultInfo;
}

/**
 * 进一步识别 RIFF 格式的具体类型（WAV、AVI、WebP等）
 */
function refineRiffFileType(buffer: Uint8Array, defaultInfo: FileTypeInfo): FileTypeInfo | null {
  if (buffer.length < 12) return defaultInfo;
  
  // RIFF 格式：前4字节是"RIFF"，接下来4字节是大小，然后4字节是格式标识
  const formatType = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  
  switch (formatType) {
    case 'WAVE':
      return { mimeType: 'audio/wav', extension: '.wav', description: 'WAV audio' };
    case 'AVI ':
      return { mimeType: 'video/avi', extension: '.avi', description: 'AVI video' };
    case 'WEBP':
      return { mimeType: 'image/webp', extension: '.webp', description: 'WebP image' };
    default:
      return defaultInfo;
  }
}

/**
 * Detect file type from URL and content
 */
export async function detectFileTypeFromUrl(url: string): Promise<{
  fileType: FileTypeInfo | null;
  contentType: string | null;
  size: number;
  urlExtension: string | null;
}> {
  try {
    // Get URL extension
    const urlPath = new URL(url).pathname;
    const urlExtension = urlPath.includes('.') 
      ? urlPath.substring(urlPath.lastIndexOf('.'))
      : null;

    // Fetch file with range request to get first few bytes
    const response = await fetch(url, {
      method: 'HEAD',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;

    // Get first 512 bytes to detect file type
    const rangeResponse = await fetch(url, {
      headers: {
        'Range': 'bytes=0-511'
      }
    });

    let fileType: FileTypeInfo | null = null;
    if (rangeResponse.ok) {
      const arrayBuffer = await rangeResponse.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      console.log('buffer = ', buffer);
      fileType = detectFileType(buffer);
    }else{
        console.log('Range request failed with msg = ', await rangeResponse.text());
    }

    return {
      fileType,
      contentType,
      size,
      urlExtension
    };
  } catch (error) {
    throw new Error(`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}