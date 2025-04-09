import type { GetSignedUrlConfig } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { pipeline } from 'node:stream/promises';
import type { DefaultOptions, File } from './types';
import { checkServiceAccount, getConfigDefaultValues, prepareUploadFile } from './utils';

export default {
  init(providedConfig: DefaultOptions) {
    const config = getConfigDefaultValues(providedConfig);
    const serviceAccount = checkServiceAccount(config.serviceAccount);

    const GCS = new Storage(
      serviceAccount && {
        projectId: serviceAccount.project_id,
        credentials: {
          client_email: serviceAccount.client_email,
          private_key: serviceAccount.private_key,
        },
      }
    );
    
    const basePath = `${config.basePath}/`.replace(/^\/+/, '');
    const baseUrl = config.baseUrl.replace('{bucket-name}', config.bucketName);

    return {
      async upload(file: File) {
        try {
          const { fileAttributes, bucketFile, fullFileName, fileExists } = await prepareUploadFile(
            file,
            config,
            basePath,
            GCS
          );
          if (fileExists) {
            await this.delete(file);
          }

          if (file.buffer) {
            await bucketFile.save(file.buffer, fileAttributes);
            file.url = `${baseUrl}/${fullFileName}`;
          }
        } catch (error) {
          if (error instanceof Error && 'message' in error) {
            console.error(`Error uploading file to Google Cloud Storage: ${error.message}`);
          }
          throw error;
        }
      },
      async uploadStream(file: File) {
        try {
          const { fileAttributes, bucketFile, fullFileName, fileExists } = await prepareUploadFile(
            file,
            config,
            basePath,
            GCS
          );
          if (fileExists) {
            await this.delete(file);
          }

          if (file.stream) {
            await pipeline(file.stream, bucketFile.createWriteStream(fileAttributes));
            file.url = `${baseUrl}/${fullFileName}`;
          }
        } catch (error) {
          if (error instanceof Error && 'message' in error) {
            console.error(`Error uploading file to Google Cloud Storage: ${error.message}`);
          }
          throw error;
        }
      },
      async delete(file: File) {
        if (!file.url) {
          return;
        }

        const fileName = file.url.replace(`${baseUrl}/`, '');
        const bucket = GCS.bucket(config.bucketName);
        try {
          await bucket.file(fileName).delete();
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 404) {
            throw new Error('Remote file was not found, you may have to delete manually.');
          }
          throw error;
        }
      },
      isPrivate() {
        return !config.publicFiles;
      },
      async getSignedUrl(file: File) {
        const options: GetSignedUrlConfig = {
          version: 'v4',
          action: 'read',
          expires: config.expires || Date.now() + 15 * 60 * 1000,
        };
        const fileName = file.url.replace(`${baseUrl}/`, '');
        const [url] = await GCS.bucket(config.bucketName).file(fileName).getSignedUrl(options);
        return { url };
      },
    };
  },
};
