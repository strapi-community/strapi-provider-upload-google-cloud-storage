import type { GetSignedUrlConfig } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { pipeline } from 'node:stream/promises';
import type { DefaultOptions, File } from './types';
import { getConfigDefaultValues, getExpires, prepareUploadFile } from './utils';

export default {
  init(providedConfig: DefaultOptions) {
    const config = getConfigDefaultValues(providedConfig);
    const { serviceAccount } = config;

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
            file.mime = fileAttributes.contentType;
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
            file.mime = fileAttributes.contentType;
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
        // Check if we can sign URLs (requires service account with client_email)
        if (!serviceAccount || !serviceAccount.client_email) {
          // If using ADC or missing client_email, we cannot generate signed URLs
          if (!config.publicFiles) {
            throw new Error(
              'Cannot generate signed URLs without service account credentials. ' +
                'Either:\n' +
                '1. Provide serviceAccount with client_email and private_key in your configuration, or\n' +
                '2. Set publicFiles to true to use direct URLs instead of signed URLs.\n' +
                'For more information, see: https://github.com/strapi-community/strapi-provider-upload-google-cloud-storage#setting-up-google-authentication'
            );
          }

          // Fallback to direct URL for public files
          console.warn(
            'Warning: Cannot generate signed URL without service account credentials. ' +
              'Returning direct URL instead. This works only for public files.'
          );
          return { url: file.url };
        }

        try {
          const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'read',
            expires: getExpires(config.expires),
          };
          const fileName = file.url.replace(`${baseUrl}/`, '');
          const [url] = await GCS.bucket(config.bucketName).file(fileName).getSignedUrl(options);
          return { url };
        } catch (error) {
          if (error instanceof Error && error.message.includes('Cannot sign data without')) {
            throw new Error(
              `Failed to generate signed URL: ${error.message}\n` +
                'This usually means your service account credentials are incomplete. ' +
                'Please ensure your serviceAccount configuration includes both client_email and private_key fields.'
            );
          }
          throw error;
        }
      },
    };
  },
};
