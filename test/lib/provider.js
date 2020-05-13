const { strict: assert } = require('assert');
const { checkServiceAccount, checkBucket, mergeConfigs } = require('../../lib/provider');

describe('/lib/provider.js', () => {
  describe('#checkServiceAccount', () => {
    describe('when config is invalid', () => {
      it('must throw error for undefined', () => {
        const error = new TypeError("Cannot read property 'serviceAccount' of undefined");
        assert.throws(() => checkServiceAccount(), error);
      });

      it('must throw error "Service Account JSON" is required!', () => {
        const config = {};
        const error = new Error('"Service Account JSON" is required!');
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error "Service Account JSON" is required! for empty value', () => {
        const config = {
          serviceAccount: '',
        };
        const error = new Error('"Service Account JSON" is required!');
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error "Bucket name" is required!', () => {
        const config = {
          serviceAccount: {},
        };
        const error = new Error('"Bucket name" is required!');
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accoplish with correct values', () => {
        const config = {
          serviceAccount: {},
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accoplish with correct values', () => {
        const config = {
          serviceAccount: {},
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accoplish with correct values', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
          },
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accoplish with correct values', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
          },
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });

      it('must throw error when serviceAccount does not accoplish with correct values', () => {
        const config = {
          serviceAccount: `{"project_id": "123", "client_email": "my@email.org"}`,
          bucketName: 'some-bucket',
        };
        const error = new Error(
          'Error parsing data "Service Account JSON", please be sure to copy/paste the full JSON file.'
        );
        assert.throws(() => checkServiceAccount(config), error);
      });
    });

    describe('when config is valid', () => {
      it('must accept configurations without errors', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
            private_key: 'a random key',
          },
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
      });

      it('must accept configurations with json string', () => {
        const config = {
          serviceAccount: `{
            "project_id": "123",
            "client_email": "my@email.org",
            "private_key": "a random key"
          }`,
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
      });

      it('must redefine baseUrl to default value', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
            private_key: 'a random key',
          },
          bucketName: 'some-bucket',
        };
        checkServiceAccount(config);
        assert.ok(Object.keys(config).includes('baseUrl'));
        assert.equal(config.baseUrl, 'https://storage.googleapis.com/{bucket-name}');
      });

      it('must accept baseUrl changing value', () => {
        const config = {
          serviceAccount: {
            project_id: '123',
            client_email: 'my@email.org',
            private_key: 'a random key',
          },
          bucketName: 'some-bucket',
          baseUrl: 'http://localhost',
        };
        checkServiceAccount(config);
        assert.equal(config.baseUrl, 'http://localhost');
      });
    });
  });

  describe('#checkBucket', () => {
    describe('when valid bucket', () => {
      it('must check if bucket exists', async () => {
        let assertCount = 0;

        const gcsMock = {
          bucket(bucketName) {
            assertCount += 1;
            assert.equal(bucketName, 'my-bucket');
            return {
              async exists() {
                assertCount += 1;
                return [true];
              },
            };
          },
        };
        await assert.doesNotReject(checkBucket(gcsMock, 'my-bucket'));
        assert.equal(assertCount, 2);
      });
    });

    describe('when bucket does not exists', async () => {
      it('must throw error message', async () => {
        let assertCount = 0;

        const gcsMock = {
          bucket(bucketName) {
            assertCount += 1;
            assert.equal(bucketName, 'my-bucket');
            return {
              async exists() {
                assertCount += 1;
                return [false];
              },
            };
          },
        };

        const error = new Error(
          'An error occurs when we try to retrieve the Bucket "my-bucket". Check if bucket exist on Google Cloud Platform.'
        );

        await assert.rejects(checkBucket(gcsMock, 'my-bucket'), error);

        assert.equal(assertCount, 2);
      });
    });
  });

  describe('#mergeConfigs', () => {
    let strapiOriginal;

    beforeEach(() => {
      strapiOriginal = global.strapi;
    });

    afterEach(() => {
      if (strapiOriginal === undefined) {
        delete global.strapi;
      } else {
        global.strapi = strapiOriginal;
      }
    });

    it('must apply configurations', () => {
      global.strapi = {
        config: {
          currentEnvironment: {
          },
        },
      };
      const result = mergeConfigs({ foo: 'bar' });
      const expected = { foo: 'bar' };
      assert.deepEqual(result, expected);
    });

    it('must merge with strapi.config.cgs global vars', () => {
      global.strapi = {
        config: {
          gcs: {
            number: 910,
            foo: 'thanos',
          },
          currentEnvironment: {
          },
        },
      };
      const result = mergeConfigs({ foo: 'bar', key: 'value' });
      const expected = { key: 'value', foo: 'thanos', number: 910 };
      assert.deepEqual(result, expected);
    });

    it('must merge with strapi.config.currentEnvironment.gcs vars', () => {
      global.strapi = {
        config: {
          currentEnvironment: {
            gcs: {
              number: 910,
              foo: 'thanos',
            },
          },
        },
      };
      const result = mergeConfigs({ foo: 'bar', key: 'value' });
      const expected = { key: 'value', foo: 'thanos', number: 910 };
      assert.deepEqual(result, expected);
    });
  });
});
