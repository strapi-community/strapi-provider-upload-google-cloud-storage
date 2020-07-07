'use strict';

const path = require('path');
const slugify = require('slugify');
const { Storage } = require('@google-cloud/storage');

/**
 * lodash _.get native port
 *
 * checkout: https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore#_get
 *
 * Another solution is use destructor variable with default value as {} on each layer
 * but it appears so tricky.
 *
 * const { a: { b: { c: d = 42 } = {} } = {} } = object
 */
const get = (obj, path, defaultValue = undefined) => {
  const travel = (regexp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};

/**
 * Check validity of Service Account configuration
 * @param config
 * @returns {{private_key}|{client_email}|{project_id}|any}
 */
const checkServiceAccount = (config) => {
  if (!config.serviceAccount) {
    throw new Error('"Service Account JSON" is required!');
  }
  if (!config.bucketName) {
    throw new Error('"Bucket name" is required!');
  }
  if (!config.baseUrl) {
    /** Set to default **/
    config.baseUrl = 'https://storage.googleapis.com/{bucket-name}';
  }
  if (!config.basePath) {
    config.basePath = '';
  }
  if (config.publicFiles === undefined) {
    config.publicFiles = true;
  }

  let serviceAccount;

  try {
    serviceAccount =
      typeof config.serviceAccount === 'string'
        ? JSON.parse(config.serviceAccount)
        : config.serviceAccount;
  } catch (e) {
    throw new Error(
      'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
    );
  }

  /**
   * Check exist
   */
  if (!serviceAccount.project_id) {
    throw new Error(
      'Error parsing data "Service Account JSON". Missing "project_id" field in JSON file.'
    );
  }
  if (!serviceAccount.client_email) {
    throw new Error(
      'Error parsing data "Service Account JSON". Missing "client_email" field in JSON file.'
    );
  }
  if (!serviceAccount.private_key) {
    throw new Error(
      'Error parsing data "Service Account JSON". Missing "private_key" field in JSON file.'
    );
  }

  return serviceAccount;
};

/**
 * Check bucket exist, or create it
 * @param GCS
 * @param bucketName
 * @returns {Promise<void>}
 */
const checkBucket = async (GCS, bucketName) => {
  let bucket = GCS.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (!exists) {
    throw new Error(
      `An error occurs when we try to retrieve the Bucket "${bucketName}". Check if bucket exist on Google Cloud Platform.`
    );
  }
};

/**
 * Merge uploadProvider config with gcs key in custom Strapi config
 * @param uploadProviderConfig
 * @returns {{private_key}|{client_email}|{project_id}|any}
 */
const mergeConfigs = (providerConfig) => {
  const customGcsConfig = get(strapi, 'config.gcs', {});
  const customEnvGcsConfig = get(strapi, 'config.currentEnvironment.gcs', {});
  return { ...providerConfig, ...customGcsConfig, ...customEnvGcsConfig };
};

/**
 * Generate upload filename including path
 *
 * @param file
 * @returns string
 */
const generateUploadFileName = (basePath, file) => {
  const backupPath =
    file.related && file.related.length > 0 && file.related[0].ref
      ? `${file.related[0].ref}`
      : `${file.hash}`;
  const filePath = file.path ? `${file.path}/` : `${backupPath}/`;
  const extension = file.ext.toLowerCase();
  const fileName = slugify(path.basename(file.name + '_' + file.hash, file.ext)) + extension;
  return `${basePath}${filePath}${fileName}`;
};

/**
 *
 * @type {{init(*=): {upload(*=): Promise<unknown>, delete(*): Promise<unknown>}}}
 */
const init = (providerConfig) => {
  const config = mergeConfigs(providerConfig);
  const serviceAccount = checkServiceAccount(config);
  const GCS = new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });
  const basePath = `${config.basePath}/`.replace(/^\/+/, '');
  const baseUrl = config.baseUrl.replace('{bucket-name}', config.bucketName);

  return {
    async upload(file) {
      try {
        const fullFileName = generateUploadFileName(basePath, file);
        await checkBucket(GCS, config.bucketName);
        const bucket = GCS.bucket(config.bucketName);
        const bucketFile = bucket.file(fullFileName);
        const [fileExists] = await bucketFile.exists();
        if (fileExists) {
          strapi.log.info('File already exist, try to remove it.');
          this.delete(file);
        }
        const fileAttributes = {
          contentType: file.mime,
          public: config.publicFiles,
          metadata: {
            contentDisposition: `inline; filename="${file.name}"`,
          },
        };
        await bucketFile.save(file.buffer, fileAttributes);
        file.url = `${baseUrl}/${fullFileName}`;
        strapi.log.debug(`File successfully uploaded to ${file.url}`);
      } catch (error) {
        // Re-throw so that the upload operation will fail
        // and error will surface to the user in the Strapi admin front-end
        console.error(`Error uploading file to Google Cloud Storage: ${error.message}`);
        throw error;
      }
    },
    async delete(file) {
      const fileName = file.url.replace(`${baseUrl}/`, '');
      const bucket = GCS.bucket(config.bucketName);
      try {
        await bucket.file(fileName).delete();
        strapi.log.debug(`File ${fileName} successfully deleted`);
      } catch (error) {
        if (error.code === 404) {
          strapi.log.warn('Remote file was not found, you may have to delete manually.');
          return;
        }
        // based on last code, it will never throw (resolves and rejects)
        // throw error;
      }
    },
  };
};

module.exports = {
  get,
  checkServiceAccount,
  checkBucket,
  mergeConfigs,
  generateUploadFileName,
  init,
};
