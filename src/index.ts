import type { GetSignedUrlConfig } from '@google-cloud/storage';
import { Storage } from '@google-cloud/storage';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
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

        // Extract filename from file.url when file.path is missing
        const fileName = file.path
          ? `${basePath}${file.path.slice(1)}/${file.hash}${file.ext?.toLowerCase() || ''}`
          : (() => {
              if (!file.url) return '';
              // Remove query parameters and fragments from URL
              const cleanUrl = file.url.split('?')[0].split('#')[0];
              // Extract path after baseUrl
              if (cleanUrl.startsWith(`${baseUrl}/`)) {
                return cleanUrl.substring(`${baseUrl}/`.length);
              }
              // Handle direct paths
              if (cleanUrl.startsWith(basePath)) {
                return cleanUrl.substring(basePath.length).replace(/^\/+/, '');
              }
              // Fallback to hash-based reconstruction
              return `${file.hash}/${file.hash}${file.ext?.toLowerCase() || ''}`;
            })();
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
        try {
          // First, try to generate signed URL - this works with ADC in GCP environments
          const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'read',
            expires: getExpires(config.expires),
          };
          // Extract filename from file.url when file.path is missing
          const fileName = file.path
            ? `${basePath}${file.path.slice(1)}/${file.hash}${file.ext?.toLowerCase() || ''}`
            : (() => {
                if (!file.url) return '';
                // Remove query parameters and fragments from URL
                const cleanUrl = file.url.split('?')[0].split('#')[0];
                // Extract path after baseUrl
                if (cleanUrl.startsWith(`${baseUrl}/`)) {
                  return cleanUrl.substring(`${baseUrl}/`.length);
                }
                // Handle direct paths
                if (cleanUrl.startsWith(basePath)) {
                  return cleanUrl.substring(basePath.length).replace(/^\/+/, '');
                }
                // Fallback to hash-based reconstruction
                return `${file.hash}/${file.hash}${file.ext?.toLowerCase() || ''}`;
              })();
          const [url] = await GCS.bucket(config.bucketName).file(fileName).getSignedUrl(options);
          return { url };
        } catch (error) {
          // If signing fails, check if this is a credentials issue
          if (error instanceof Error && error.message.includes('Cannot sign data without')) {
            // Check if we're in a GCP environment where ADC should work
            const isGCPEnvironment = this.detectGCPEnvironment();

            if (!isGCPEnvironment && (!serviceAccount || !serviceAccount.client_email)) {
              // Non-GCP environment requires explicit service account credentials
              if (!config.publicFiles) {
                throw new Error(
                  'Cannot generate signed URLs without service account credentials. ' +
                    'Either:\n' +
                    '1. Provide serviceAccount with client_email and private_key in your configuration, or\n' +
                    '2. Set publicFiles to true to use direct URLs instead of signed URLs.\n' +
                    'For more information, see: https://github.com/strapi-community/strapi-provider-upload-google-cloud-storage#setting-up-google-authentication'
                );
              }

              // Fallback to direct URL for public files in non-GCP environments
              console.warn(
                'Warning: Cannot generate signed URL without service account credentials. ' +
                  'Returning direct URL instead. This works only for public files.'
              );
              return { url: file.url };
            }

            // For GCP environments, provide more specific error message
            if (isGCPEnvironment) {
              throw new Error(
                `Failed to generate signed URL in GCP environment: ${error.message}\n` +
                  'This may indicate that your GCP service account lacks the necessary permissions for URL signing. ' +
                  'Please ensure your service account has the "Storage Object Admin" or "Storage Admin" role.'
              );
            }

            // Fallback error for other cases
            throw new Error(
              `Failed to generate signed URL: ${error.message}\n` +
                'This usually means your service account credentials are incomplete. ' +
                'Please ensure your serviceAccount configuration includes both client_email and private_key fields.'
            );
          }

          // Re-throw other errors as-is
          throw error;
        }
      },

      detectGCPEnvironment() {
        // Check common GCP environment variables
        const gcpEnvVars = [
          'GOOGLE_CLOUD_PROJECT',
          'GCLOUD_PROJECT',
          'GAE_APPLICATION', // App Engine
          'GAE_SERVICE', // App Engine
          'K_SERVICE', // Cloud Run
          'FUNCTION_NAME', // Cloud Functions
          'FUNCTION_TARGET', // Cloud Functions
        ];

        // Check if we're running in a GCP environment
        const hasGCPEnvVar = gcpEnvVars.some((envVar) => process.env[envVar]);

        // Additional check for Google metadata server (available in GCP environments)
        const hasGoogleMetadata =
          process.env.GCE_METADATA_HOST || process.env.KUBERNETES_SERVICE_HOST; // GKE

        return hasGCPEnvVar || !!hasGoogleMetadata;
      },
    };
  },
};
