const { strict: assert } = require('assert');
const { checkServiceAccount } = require('../../lib/provider');

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
});
