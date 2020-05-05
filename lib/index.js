'use strict';

const _ = require('lodash');
const path = require('path');
const slugify = require('slugify');
const {Storage} = require('@google-cloud/storage');

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
            '"Bucket name" is required!'
        );
    }
    if (!config.baseUrl) {
        /** Set to default **/
        config.baseUrl = 'https://storage.googleapis.com/{bucket-name}';
    }
    try {
        const serviceAccount = typeof config.serviceAccount==='string' ? JSON.parse(config.serviceAccount) : config.serviceAccount;

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
 * @returns {Promise<void>}
 */
const checkBucket = async (GCS, bucketName) => {
    let bucket = GCS.bucket(bucketName);
    await bucket.exists().then((data) => {
        if (!data[0]) {
            throw new Error(
                'An error occurs when we try to retrieve the Bucket "' + bucketName + '". Check if bucket exist on Google Cloud Platform.'
            );
        }
    });
};

/**
 *
 * @type {{init(*=): {upload(*=): Promise<unknown>, delete(*): Promise<unknown>}}}
 */
module.exports = {
    init(config) {
        const serviceAccount = checkServiceAccount(config);
        const GCS = new Storage({
            projectId: serviceAccount.project_id,
            credentials: {
                client_email: serviceAccount.client_email,
                private_key: serviceAccount.private_key
            }
        });

        return {
            upload(file) {
                return new Promise((resolve, reject) => {
                    const backupPath = file.related && file.related.length > 0 && file.related[0].ref ? `${file.related[0].ref}` : `${file.hash}`
                    const filePath = file.path ? `${file.path}/` : `${backupPath}/`;
                    const fileName = slugify(path.basename(file.name + '_' + file.hash, file.ext)) + file.ext.toLowerCase();

                    checkBucket(GCS, config.bucketName)
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
            delete(file) {
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
