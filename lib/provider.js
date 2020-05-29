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
  await bucket.exists().then((data) => {
    if (!data[0]) {
      throw new Error(
        'An error occurs when we try to retrieve the Bucket "' +
          bucketName +
          '". Check if bucket exist on Google Cloud Platform.'
      );
    }
  });
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

  return {
    upload(file) {
      return new Promise((resolve, reject) => {
        const backupPath =
          file.related && file.related.length > 0 && file.related[0].ref
            ? `${file.related[0].ref}`
            : `${file.hash}`;
        const filePath = file.path ? `${file.path}/` : `${backupPath}/`;
        const fileName =
          slugify(path.basename(file.name + '_' + file.hash, file.ext)) + file.ext.toLowerCase();

        checkBucket(GCS, config.bucketName)
          .then(() => {
            /**
             * Check if the file already exist and force to remove it on Bucket
             */
            GCS.bucket(config.bucketName)
              .file(`${basePath}${filePath}${fileName}`)
              .exists()
              .then((exist) => {
                if (exist[0]) {
                  strapi.log.info('File already exist, try to remove it.');
                  const fileName = `${file.url.replace(
                    config.baseUrl.replace('{bucket-name}', config.bucketName) + '/',
                    ''
                  )}`;

                  GCS.bucket(config.bucketName)
                    .file(`${fileName}`)
                    .delete()
                    .then(() => {
                      strapi.log.debug(`File ${fileName} successfully deleted`);
                    })
                    .catch((error) => {
                      if (error.code === 404) {
                        return strapi.log.warn(
                          'Remote file was not found, you may have to delete manually.'
                        );
                      }
                    });
                }
              });
          })
          .then(() => {
            /**
             * Then save file
             */
            GCS.bucket(config.bucketName)
              .file(`${basePath}${filePath}${fileName}`)
              .save(file.buffer, {
                contentType: file.mime,
                public: config.publicFiles,
                metadata: {
                  contentDisposition: `inline; filename="${file.name}"`,
                },
              })
              .then(() => {
                file.url = `${config.baseUrl.replace(
                  /{bucket-name}/,
                  config.bucketName
                )}/${basePath}${filePath}${fileName}`;
                strapi.log.debug(`File successfully uploaded to ${file.url}`);
                resolve();
              })
              .catch((error) => {
                return reject(error);
              });
          });
      });
    },
    delete(file) {
      return new Promise((resolve, reject) => {
        const fileName = `${file.url.replace(
          config.baseUrl.replace('{bucket-name}', config.bucketName) + '/',
          ''
        )}`;

        GCS.bucket(config.bucketName)
          .file(fileName)
          .delete()
          .then(() => {
            strapi.log.debug(`File ${fileName} successfully deleted`);
          })
          .catch((error) => {
            if (error.code === 404) {
              return strapi.log.warn('Remote file was not found, you may have to delete manually.');
            }
            reject(error);
          });
        resolve();
      });
    },
  };
};

module.exports = {
  get,
  checkServiceAccount,
  checkBucket,
  mergeConfigs,
  init,
};
