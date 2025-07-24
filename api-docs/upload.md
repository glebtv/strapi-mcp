## REST API: Upload files

The [Media Library feature](https://docs.strapi.io/cms/features/media-library) is powered in the back-end server of Strapi by the `upload` package. To upload files to Strapi, you can either use the Media Library directly from the admin panel, or use the [REST API](https://docs.strapi.io/cms/api/rest), with the following available endpoints :

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/upload/files` | Get a list of files |
| GET | `/api/upload/files/:id` | Get a specific file |
| POST | `/api/upload` | Upload files |
| POST | `/api/upload?id=x` | Update fileInfo |
| DELETE | `/api/upload/files/:id` | Delete a file |

Notes

-   [Folders](https://docs.strapi.io/cms/features/media-library#organizing-assets-with-folders) are an admin panel-only feature and are not part of the Content API (REST or GraphQL). Files uploaded through REST are located in the automatically created "API Uploads" folder.
-   The GraphQL API does not support uploading media files. To upload files, use the REST API or directly add files from the [Media Library](https://docs.strapi.io/cms/features/media-library) in the admin panel. Some GraphQL mutations to update or delete uploaded media files are still possible (see [GraphQL API documentation](https://docs.strapi.io/cms/api/graphql#mutations-on-media-files) for details).

Upload one or more files to your application.

`files` is the only accepted parameter, and describes the file(s) to upload. The value(s) can be a Buffer or Stream:

-   Browser
-   Node.js

```
<form>  <!-- Can be multiple files -->  <input type="file" name="files" />  <input type="submit" value="Submit" /></form><script type="text/javascript">  const form = document.querySelector('form');  form.addEventListener('submit', async (e) => {    e.preventDefault();    await fetch('/api/upload', {      method: 'post',      body: new FormData(e.target)    });  });</script>
```

Caution

You have to send FormData in your request body.

## Upload entry files[](https://docs.strapi.io/cms/api/rest#upload-entry-files "Direct link to Upload entry files")

Upload one or more files that will be linked to a specific entry.

The following parameters are accepted:

| Parameter | Description |
| --- | --- |
| `files` | The file(s) to upload. The value(s) can be a Buffer or Stream. |
| `path` (optional) | The folder where the file(s) will be uploaded to (only supported on strapi-provider-upload-aws-s3). |
| `refId` | The ID of the entry which the file(s) will be linked to. |
| `ref` | The unique ID (uid) of the model which the file(s) will be linked to (see more below). |
| `source` (optional) | The name of the plugin where the model is located. |
| `field` | The field of the entry which the file(s) will be precisely linked to. |

For example, given the `Restaurant` model attributes:

/src/api/restaurant/content-types/restaurant/schema.json

```
{  // ...  "attributes": {    "name": {      "type": "string"    },    "cover": {      "type": "media",      "multiple": false,    }  }// ...}
```

The following is an example of a corresponding front-end code:

```
<form>  <!-- Can be multiple files if you setup "collection" instead of "model" -->  <input type="file" name="files" />  <input type="text" name="ref" value="api::restaurant.restaurant" />  <input type="text" name="refId" value="5c126648c7415f0c0ef1bccd" />  <input type="text" name="field" value="cover" />  <input type="submit" value="Submit" /></form><script type="text/javascript">  const form = document.querySelector('form');  form.addEventListener('submit', async (e) => {    e.preventDefault();    await fetch('/api/upload', {      method: 'post',      body: new FormData(e.target)    });  });</script>
```

Caution

You have to send FormData in your request body.

## Update fileInfo[](https://docs.strapi.io/cms/api/rest#update-fileinfo "Direct link to Update fileInfo")

Update a file in your application.

`fileInfo` is the only accepted parameter, and describes the fileInfo to update:

```
import { FormData } from 'formdata-node';import fetch from 'node-fetch';const fileId = 50;const newFileData = {  alternativeText: 'My new alternative text for this image!',};const form = new FormData();form.append('fileInfo', JSON.stringify(newFileData));const response = await fetch(`http://localhost:1337/api/upload?id=${fileId}`, {  method: 'post',  body: form,});
```

## Models definition[](https://docs.strapi.io/cms/api/rest#models-definition "Direct link to Models definition")

Adding a file attribute to a [model](https://docs.strapi.io/cms/backend-customization/models) (or the model of another plugin) is like adding a new association.

The following example lets you upload and attach one file to the `avatar` attribute:

/src/api/restaurant/content-types/restaurant/schema.json

```
{  // ...  {    "attributes": {      "pseudo": {        "type": "string",        "required": true      },      "email": {        "type": "email",        "required": true,        "unique": true      },      "avatar": {        "type": "media",        "multiple": false,      }    }  }  // ...}
```

The following example lets you upload and attach multiple pictures to the `restaurant` content-type:

/src/api/restaurant/content-types/restaurant/schema.json

```
{  // ...  {    "attributes": {      "name": {        "type": "string",        "required": true      },      "covers": {        "type": "media",        "multiple": true,      }    }  }  // ...}
```