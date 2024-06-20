import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import axios from 'axios';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID as string;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID as string;
const R2_SECRET_KEY_ID = process.env.R2_SECRET_KEY_ID as string;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME as string;

export async function uploadImageToS3(imageUrl: string, key: string) {
  const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_KEY_ID,
    },
  });

  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(response.data, 'binary');

  const uploadParams = {
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: imageBuffer,
    ContentType: response.headers['content-type'],
  };

  try {
    const result = await s3Client.send(new PutObjectCommand(uploadParams));
    if (result.$metadata.httpStatusCode !== 200) {
      console.error('Error uploading image:', result);
      return null;
    }
    return `https://gengar.baobo.me/${key}`;
  } catch (error) {
    console.error('Error uploading image:', error);
  }
}
