The REST API allows accessing the [content-types](https://docs.strapi.io/cms/backend-customization/models) through API endpoints. Strapi automatically creates [API endpoints](https://docs.strapi.io/cms/api/rest#endpoints) when a content-type is created. [API parameters](https://docs.strapi.io/cms/api/rest/parameters) can be used when querying API endpoints to refine the results.

This section of the documentation is for the REST API reference. We also have [guides](https://docs.strapi.io/cms/api/rest/guides/intro) available for specific use cases.

Note

By default, the REST API responses only include top-level fields and does not populate any relations, media fields, components, or dynamic zones. Use the [`populate` parameter](https://docs.strapi.io/cms/api/rest/populate-select) to populate specific fields. Ensure that the find permission is given to the field(s) for the relation(s) you populate.

Strapi Client

The [Strapi Client](https://docs.strapi.io/cms/api/client) library simplifies interactions with your Strapi back end, providing a way to fetch, create, update, and delete content.

## Endpoints[](https://docs.strapi.io/cms/api/rest#endpoints "Direct link to Endpoints")

For each Content-Type, the following endpoints are automatically generated:

Plural API ID vs. Singular API ID:

-   Collection type
-   Single type

| Method | URL | Description |
| --- | --- | --- |
| `GET` | `/api/:pluralApiId` | [Get a list of document](https://docs.strapi.io/cms/api/rest#get-all) |
| `POST` | `/api/:pluralApiId` | [Create a document](https://docs.strapi.io/cms/api/rest#create) |
| `GET` | `/api/:pluralApiId/:documentId` | [Get a document](https://docs.strapi.io/cms/api/rest#get) |
| `PUT` | `/api/:pluralApiId/:documentId` | [Update a document](https://docs.strapi.io/cms/api/rest#update) |
| `DELETE` | `/api/:pluralApiId/:documentId` | [Delete a document](https://docs.strapi.io/cms/api/rest#delete) |

Real-world examples of endpoints:

## Requests[](https://docs.strapi.io/cms/api/rest#requests "Direct link to Requests")

Strapi 5 vs. Strapi v4

Strapi 5's Content API includes 2 major differences with Strapi v4:

-   The response format has been flattened, which means attributes are no longer nested in a `data.attributes` object and are directly accessible at the first level of the `data` object (e.g., a content-type's "title" attribute is accessed with `data.title`).
-   Strapi 5 now uses **documents** and documents are accessed by their `documentId` (see [breaking change entry](https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/use-document-id) for details)

Requests return a response as an object which usually includes the following keys:

-   `data`: the response data itself, which could be:
    
    -   a single document, as an object with the following keys:
        -   `id` (integer)
        -   `documentId` (string), which is the unique identifier to use when querying a given document,
        -   the attributes (each attribute's type depends on the attribute, see [models attributes](https://docs.strapi.io/cms/backend-customization/models#model-attributes) documentation for details)
        -   `meta` (object)
    -   a list of documents, as an array of objects
    -   a custom response
-   `meta` (object): information about pagination, publication state, available locales, etc.
    
-   `error` (object, _optional_): information about any [error](https://docs.strapi.io/cms/error-handling) thrown by the request
    

Note

Some plugins (including Users & Permissions and Upload) may not follow this response format.

### Get documents[](https://docs.strapi.io/cms/api/rest#get-all "Direct link to Get documents")

Returns documents matching the query filters (see [API parameters](https://docs.strapi.io/cms/api/rest/parameters) documentation).

Tip: Strapi 5 vs. Strapi 4

In Strapi 5 the response format has been flattened, and attributes are directly accessible from the `data` object instead of being nested in `data.attributes`.

You can pass an optional header while you're migrating to Strapi 5 (see the [related breaking change](https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/new-response-format)).

Example request

`GET http://localhost:1337/api/restaurants`

Example response

```
{  "data": [    {      "id": 2,      "documentId": "hgv1vny5cebq2l3czil1rpb3",      "Name": "BMK Paris Bamako",      "Description": null,      "createdAt": "2024-03-06T13:42:05.098Z",      "updatedAt": "2024-03-06T13:42:05.098Z",      "publishedAt": "2024-03-06T13:42:05.103Z",      "locale": "en"    },    {      "id": 4,      "documentId": "znrlzntu9ei5onjvwfaalu2v",      "Name": "Biscotte Restaurant",      "Description": [        {          "type": "paragraph",          "children": [            {              "type": "text",              "text": "Welcome to Biscotte restaurant! Restaurant Biscotte offers a cuisine based on fresh, quality products, often local, organic when possible, and always produced by passionate producers."            }          ]        }      ],      "createdAt": "2024-03-06T13:43:30.172Z",      "updatedAt": "2024-03-06T13:43:30.172Z",      "publishedAt": "2024-03-06T13:43:30.175Z",      "locale": "en"    }  ],  "meta": {    "pagination": {      "page": 1,      "pageSize": 25,      "pageCount": 1,      "total": 2    }  }}
```

### Get a document[](https://docs.strapi.io/cms/api/rest#get "Direct link to Get a document")

Returns a document by `documentId`.

Strapi 5 vs. Strapi v4

In Strapi 5, a specific document is reached by its `documentId`.

Example request

`GET http://localhost:1337/api/restaurants/j964065dnjrdr4u89weh79xl`

Example response

```
{  "data": {    "id": 6,    "documentId": "znrlzntu9ei5onjvwfaalu2v",    "Name": "Biscotte Restaurant",    "Description": [      {        "type": "paragraph",        "children": [          {            "type": "text",            "text": "Welcome to Biscotte restaurant! Restaurant Biscotte offers a cuisine bassics, such as 4 Formaggi or Calzone, and our original creations such as Do Luigi or Nduja."          }        ]      }    ],    "createdAt": "2024-02-27T10:19:04.953Z",    "updatedAt": "2024-03-05T15:52:05.591Z",    "publishedAt": "2024-03-05T15:52:05.600Z",    "locale": "en"  },  "meta": {}}
```

### Create a document[](https://docs.strapi.io/cms/api/rest#create "Direct link to Create a document")

Creates a document and returns its value.

If the [Internationalization (i18n) plugin](https://docs.strapi.io/cms/features/internationalization) is installed, it's possible to use POST requests to the REST API to [create localized documents](https://docs.strapi.io/cms/api/rest/locale#rest-delete).

Example request

`POST http://localhost:1337/api/restaurants`

```
{   "data": {    "Name": "Restaurant D",    "Description": [ // uses the "Rich text (blocks)" field type      {        "type": "paragraph",        "children": [          {            "type": "text",            "text": "A very short description goes here."          }        ]      }    ]  }}
```

Example response

```
{  "data": {    "documentId": "bw64dnu97i56nq85106yt4du",    "Name": "Restaurant D",    "Description": [      {        "type": "paragraph",        "children": [          {            "type": "text",            "text": "A very short description goes here."          }        ]      }    ],    "createdAt": "2024-03-05T16:44:47.689Z",    "updatedAt": "2024-03-05T16:44:47.689Z",    "publishedAt": "2024-03-05T16:44:47.687Z",    "locale": "en"  },  "meta": {}}
```

### Update a document[](https://docs.strapi.io/cms/api/rest#update "Direct link to Update a document")

Partially updates a document by `id` and returns its value.

Send a `null` value to clear fields.

NOTES

-   Even with the [Internationalization (i18n) plugin](https://docs.strapi.io/cms/features/internationalization) installed, it's currently not possible to [update the locale of a document](https://docs.strapi.io/cms/api/rest/locale#rest-update).
-   While updating a document, you can define its relations and their order (see [Managing relations through the REST API](https://docs.strapi.io/cms/api/rest/relations) for more details).

Example request

`PUT http://localhost:1337/api/restaurants/hgv1vny5cebq2l3czil1rpb3`

```
{   "data": {    "Name": "BMK Paris Bamako", // we didn't change this field but still need to include it    "Description": [ // uses the "Rich text (blocks)" field type      {        "type": "paragraph",        "children": [          {            "type": "text",            "text": "A very short description goes here."          }        ]      }    ]  }}
```

Example response

```
{  "data": {    "id": 9,    "documentId": "hgv1vny5cebq2l3czil1rpb3",    "Name": "BMK Paris Bamako",    "Description": [      {        "type": "paragraph",        "children": [          {            "type": "text",            "text": "A very short description goes here."          }        ]      }    ],    "createdAt": "2024-03-06T13:42:05.098Z",    "updatedAt": "2024-03-06T14:16:56.883Z",    "publishedAt": "2024-03-06T14:16:56.895Z",    "locale": "en"  },  "meta": {}}
```

### Delete a document[](https://docs.strapi.io/cms/api/rest#delete "Direct link to Delete a document")

Deletes a document.

`DELETE` requests only send a 204 HTTP status code on success and do not return any data in the response body.

Example request

`DELETE http://localhost:1337/api/restaurants/bw64dnu97i56nq85106yt4du`