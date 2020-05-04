# strapi-provider-upload-google-cloud-storage

[![npm version](https://img.shields.io/npm/v/strapi-provider-upload-google-cloud-storage.svg)](https://www.npmjs.org/package/strapi-provider-upload-google-cloud-storage)
[![npm downloads](https://img.shields.io/npm/dm/strapi-provider-upload-google-cloud-storage.svg)](https://www.npmjs.org/package/strapi-provider-upload-google-cloud-storage)
[![npm dependencies](https://david-dm.org/strapi/strapi-provider-upload-google-cloud-storage.svg)](https://david-dm.org/Lith/strapi-provider-upload-google-cloud-storage)

**Non-Official** Google Cloud Storage Provider for Strapi Upload

## Installation

Install the package from your app root directory

with `npm`
```
npm install strapi-provider-upload-google-cloud-storage --save
```

or `yarn`
```
yarn install strapi-provider-upload-google-cloud-storage
```

## Create your Bucket on Google Cloud Storage

## Setting up Google authentification

1. In the GCP Console, go to the **Create service account key** page.. 
    - **[Go to the create service account key page](https://console.cloud.google.com/apis/credentials/serviceaccountkey)**
2. From the **Service account** list, select **New service account**.
3. In the **Service account name** field, enter a name.
4. From the **Role** list, select **Storage > Administrator**.   
5. Click **Create**. A JSON file that contains your key downloads to your computer.

## Setting up the a configuration file

You will find below 3 examples of configurations, for each example :
1. Copy the full content of the downloaded JSON file
2. Open the configuration file 
3. Paste it into the "Service Account JSON" field 
4. Set the `Bucket-name` field
6. Save the configuration file
7. Enjoy !

**Example with one configuration for all environments (dev/stage/prod)**

`./extensions/upload/config/settings.json`
```json
{
  "provider": "google-cloud-storage",
  "providerOptions": {
    "serviceAccount": "Service Account JSON",
    "bucketName": "Bucket-name",
    "baseUrl": "https://storage.googleapis.com/{bucket-name}"
  }
}
```

**Example with environment variable**

`./extensions/upload/config/settings.json`
```json
{
  "provider": "google-cloud-storage",
  "providerOptions": {
    "serviceAccount": "${process.env.GCS_SERVICE_ACCOUNT || Service Account JSON}",
    "bucketName": "${process.env.GCS_BUCKET_NAME || Bucket-name}",
    "baseUrl": "${process.env.GCS_BASE_URL || https://storage.googleapis.com/{bucket-name}}"
  }
}
```

You can rename the `environment variables` as you like.
All variable are optional, you can setting up only `bucketName` if you need to change only the `bucketName`.

**Example with multi configuration multi upload : one by environment (dev/stage/prod)**

`./extensions/upload/config/settings.js`
```js
const stagingProviderOptions = {
  serviceAccount: 'Service Account JSON', // json configuration 
    bucketName: 'Bucket-name', // name of the bucket
    baseUrl: 'https://storage.googleapis.com/{bucket-name}'
};

const productionProviderOptions = {
  serviceAccount: 'Service Account JSON', // json configuration 
  bucketName: 'Bucket-name', // name of the bucket
  baseUrl: 'https://storage.googleapis.com/{bucket-name}'
};


if (process.env.NODE_ENV === 'production') {
  module.exports = {
    provider: 'google-cloud-storage',
    providerOptions: productionProviderOptions
  };
}
else if (process.env.NODE_ENV === 'staging') {
  module.exports = {
    provider: 'google-cloud-storage',
    providerOptions: stagingProviderOptions
  };
}
else {
  module.exports = {
    provider: 'local'
  };
}
```

## How to configure variable ?

#### `serviceAccount` :

JSON data provide by Google Account (explained before).

#### `bucketName` :

The name of the bucket on Google Cloud Storage.
You can find more information about it here : 
- https://cloud.google.com/storage/docs/locations?hl=fr

#### `baseUrl` :

Define your base Url, first is default value :
- https://storage.googleapis.com/{bucket-name}
- https://{bucket-name}
- http://{bucket-name}

## Important information

From release `3.0.0-beta.20` the bucketLocation is no longer supported.
The plugin will not create automatically the bucket, you need to configure it.

## Resources

* [MIT License](LICENSE.md)

## Links

- [Strapi website](http://strapi.io/)
- [Strapi community on Slack](http://slack.strapi.io)
- [Strapi news on Twitter](https://twitter.com/strapijs)

## Support

- [Slack](http://slack.strapi.io) (Highly recommended for faster support)
- [GitHub](https://github.com/Lith/strapi-provider-upload-google-cloud-storage) (Bug reports, contributions)
