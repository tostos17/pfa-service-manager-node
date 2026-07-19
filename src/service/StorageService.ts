import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'eu-north-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
});

const bucketName = process.env.S3_BUCKET_NAME || 'pfa-player-photo';
const region = process.env.AWS_REGION || 'eu-north-1';

export class StorageService {
    async uploadFile(fileBuffer: Buffer, originalFilename: string, mimeType: string, folderName: string): Promise<string> {
        if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('Cannot upload an empty file');
        }

        const extension = originalFilename.includes('.') ? originalFilename.substring(originalFilename.lastIndexOf('.')) : '';
        const uniqueKey = `${folderName}/${randomUUID()}${extension}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: uniqueKey,
            Body: fileBuffer,
            ContentType: mimeType
        });

        await s3Client.send(command);

        return `https://${bucketName}.s3.${region}.amazonaws.com/${uniqueKey}`;
    }
}

export const storageService = new StorageService();
