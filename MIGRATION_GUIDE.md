# Migration Guide

Please be careful and save all of your datas before beginning the migration.

### Follow official migration guide of Strapi

_Work in progress_, not available yet`

### Update `provider` field in `files` table 

This action will be necessary if you want to delete old files imported in Strapi V3, later.

```mysql
UPDATE `files` SET `provider` = 'strapi-provider-upload-google-cloud-storage'  WHERE `provider` = 'google-cloud-storage';
```

/!\ Be careful, this migration guide is not finished yet. /!\

