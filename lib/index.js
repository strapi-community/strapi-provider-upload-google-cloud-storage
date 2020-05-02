'use strict';

const _ = require('lodash');
const {Storage} = require('@google-cloud/storage');
const trimParam = inVar => (typeof inVar === 'string' ? inVar.trim() : 
    typeof invar === 'object' ? invar : undefined);

/**
 * Load config from environment variable (if provided)
 * @param config
 * @returns {*}
 */
const checkConfig = (config) => {
    let newConfig = config;
    if (strapi.config.gcs) {
        if (strapi.config.gcs.serviceAccount) {
            config.serviceAccount = trimParam(strapi.config.gcs.serviceAccount);
        }
        if (strapi.config.gcs.bucketName) {
            config.bucketName = trimParam(strapi.config.gcs.bucketName);
        }
        if (strapi.config.gcs.bucketLocation) {
            config.bucketLocation = trimParam(strapi.config.gcs.bucketLocation);
        }
        if (strapi.config.gcs.baseUrl) {
            config.baseUrl = trimParam(strapi.config.gcs.baseUrl);
        }
    }
    if (strapi.config.currentEnvironment.gcs) {
        if (strapi.config.currentEnvironment.gcs.serviceAccount) {
            config.serviceAccount = trimParam(strapi.config.gcs.serviceAccount);
        }
        if (strapi.config.currentEnvironment.gcs.bucketName) {
            config.bucketName = trimParam(strapi.config.gcs.bucketName);
        }
        if (strapi.config.currentEnvironment.gcs.bucketLocation) {
            config.bucketLocation = trimParam(strapi.config.gcs.bucketLocation);
        }
        if (strapi.config.currentEnvironment.gcs.baseUrl) {
            config.baseUrl = trimParam(strapi.config.gcs.baseUrl);
        }
    }

    return newConfig;
};

/**
 * Check validity of Service Account configuration
 * @param config
 * @returns {{private_key}|{client_email}|{project_id}|any}
 */
const checkServiceAccount = (config) => {
    if (!config.serviceAccount) {
        throw new Error(
            '"Service Account JSON" is required!'
        );
    }
    if (!config.bucketName) {
        throw new Error(
            '"Multi-Regional Bucket name" is required!'
        );
    }
    try {
        const serviceAccount = typeof config.serviceAccount === 'string' ? JSON.parse(config.serviceAccount) :
            typeof config.serviceAccount === 'object' ? config.serviceAccount : undefined;
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
    } catch (e) {
        throw new Error(
            'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
    }
};

/**
 * Check bucket exist, or create it
 * @param GCS
 * @param bucketName
 * @param bucketLocation
 * @returns {Promise<void>}
 */
const checkBucket = async (GCS, bucketName, bucketLocation) => {
    let bucket = GCS.bucket(bucketName);
    await bucket.exists().then((data) => {
        if (!data[0]) {
            try {
                GCS.createBucket(bucketName, {
                    location: bucketLocation,
                    storageClass: 'multi_regional'
                }).then((data) => {
                    strapi.log.debug(`Bucket ${bucketName} successfully created.`);
                });
            } catch (e) {
                throw new Error(
                    'An error occurs when we try to create the Bucket "' + bucketName + '". Please try again on Google Cloud Platform directly.'
                )
            }
        }
    });
};

/**
 *
 * @type {{init: (function(*=): {upload: (function(*): Promise<any>)}), checkServiceAccount: module.exports.checkServiceAccount, provider: string, auth: {bucketName: {label: string, type: string}, bucketLocation: {values: string[], label: string, type: string}, serviceAccount: {label: string, type: string}, baseUrl: {values: string[], label: string, type: string}}}, checkBucket: module.exports.checkBucket, name: string}}
 */
module.exports = {
    provider: 'google-cloud-storage',
    name: 'Google Cloud Storage',
    auth: {
        serviceAccount: {
            label: 'Service Account JSON',
            type: 'textarea'
        },
        bucketName: {
            label: 'Multi-Regional Bucket Name',
            type: 'text'
        },
        bucketLocation: {
            label: 'Multi-Regional location',
            type: 'enum',
            values: [
                'asia',
                'eu',
                'us'
            ]
        },
        baseUrl: {
            label: 'Use bucket name as base URL (https://cloud.google.com/storage/docs/domain-name-verification)',
            type: 'enum',
            values: [
                'https://storage.googleapis.com/{bucket-name}',
                'https://{bucket-name}',
                'http://{bucket-name}'
            ]
        }
    },
    init: (config) => {
        config = checkConfig(config);
        const serviceAccount = checkServiceAccount(config);
        const GCS = new Storage({
            projectId: serviceAccount.project_id,
            credentials: {
                client_email: serviceAccount.client_email,
                private_key: serviceAccount.private_key
            }
        });

        return {
            upload: (file) => {
                return new Promise((resolve, reject) => {
                    const backupPath = file.related && file.related.length > 0 && file.related[0].ref ? `${file.related[0].ref}` : `${file.hash}`
                    const filePath = file.path ? `${file.path}/` : `${backupPath}/`;
                    const fileName = file.hash + file.ext.toLowerCase();

                    checkBucket(GCS, config.bucketName, config.bucketLocation)
                        .then(() => {
                            /**
                             * Check if the file already exist and force to remove it on Bucket
                             */
                            GCS
                                .bucket(config.bucketName)
                                .file(`${filePath}${fileName}`)
                                .exists()
                                .then((exist) => {
                                    if (exist[0]) {
                                        strapi.log.info(
                                            'File already exist, try to remove it.'
                                        );
                                        const fileName = `${file.url.replace(config.baseUrl.replace('{bucket-name}', config.bucketName) + '/', '')}`;

                                        GCS
                                            .bucket(config.bucketName)
                                            .file(`${fileName}`)
                                            .delete()
                                            .then(() => {
                                                strapi.log.debug(`File ${fileName} successfully deleted`);
                                            })
                                            .catch(error => {
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
                            GCS
                                .bucket(config.bucketName)
                                .file(`${filePath}${fileName}`)
                                .save(file.buffer, {
                                        contentType: file.mime,
                                        public: true,
                                        metadata: {
                                            contentDisposition: `inline; filename="${file.name}"`
                                        }
                                    }
                                )
                                .then(() => {
                                    file.url = `${config.baseUrl.replace(/{bucket-name}/, config.bucketName)}/${filePath}${fileName}`;
                                    strapi.log.debug(`File successfully uploaded to ${file.url}`);
                                    resolve();
                                })
                                .catch(error => {
                                    return reject(error);
                                });
                        });
                });
            },
            delete: (file) => {
                return new Promise((resolve, reject) => {
                    const fileName = `${file.url.replace(config.baseUrl.replace('{bucket-name}', config.bucketName) + '/', '')}`;

                    GCS
                        .bucket(config.bucketName)
                        .file(fileName)
                        .delete()
                        .then(() => {
                                strapi.log.debug(`File ${fileName} successfully deleted`);
                            }
                        )
                        .catch(error => {
                            if (error.code === 404) {
                                return strapi.log.warn(
                                    'Remote file was not found, you may have to delete manually.'
                                );
                            }
                            reject(error);
                        });
                    resolve();
                })
            }
        }
    }
};
