## REST API: `locale`

The [Internationalization (i18n) feature](https://docs.strapi.io/cms/features/internationalization) adds new abilities to the [REST API](https://docs.strapi.io/cms/api/rest).

The `locale` [API parameter](https://docs.strapi.io/cms/api/rest/parameters) can be used to work with documents only for a specified locale. `locale` takes a locale code as a value (see [full list of available locales](https://github.com/strapi/strapi/blob/main/packages/plugins/i18n/server/src/constants/iso-locales.json)).

Tip

If the `locale` parameter is not defined, it will be set to the default locale. `en` is the default locale when a new Strapi project is created, but another locale can be [set as the default locale](https://docs.strapi.io/cms/features/internationalization#settings) in the admin panel.

For instance, by default, a GET request to `/api/restaurants` will return the same response as a request to `/api/restaurants?locale=en`.

The following table lists the new possible use cases added by i18n to the REST API and gives syntax examples (you can click on requests to jump to the corresponding section with more details):

-   For collection types
-   For single types

| Use case | Syntax example  
and link for more information |
| --- | --- |
| Get all documents in a specific locale | [`GET /api/restaurants?locale=fr`](https://docs.strapi.io/cms/api/rest#rest-get-all) |
| Get a specific locale version for a document | [`GET /api/restaurants/abcdefghijklmno456?locale=fr`](https://docs.strapi.io/cms/api/rest#get-one-collection-type) |
| Create a new document for the default locale | [`POST /api/restaurants`](https://docs.strapi.io/cms/api/rest#rest-create-default-locale)  
\+ pass attributes in the request body |
| Create a new document for a specific locale | [`POST /api/restaurants`](https://docs.strapi.io/cms/api/rest#rest-create-specific-locale)  
\+ pass attributes **and locale** in the request body |
| Create a new, or update an existing, locale version for an existing document | [`PUT /api/restaurants/abcdefghijklmno456?locale=fr`](https://docs.strapi.io/cms/api/rest#rest-put-collection-type)  
\+ pass attributes in the request body |
| Delete a specific locale version of a document | [`DELETE /api/restaurants/abcdefghijklmno456?locale=fr`](https://docs.strapi.io/cms/api/rest#rest-delete-collection-type) |

### `GET` Get all documents in a specific locale[](https://docs.strapi.io/cms/api/rest#rest-get-all "Direct link to rest-get-all")

Example request

`GET http://localhost:1337/api/restaurants?locale=fr`

Example response

```
{  "data": [    {      "id": 5,      "documentId": "h90lgohlzfpjf3bvan72mzll",      "Title": "Meilleures pizzas",      "Body": [        {          "type": "paragraph",          "children": [            {              "type": "text",              "text": "On déguste les meilleures pizzas de la ville à la Pizzeria Arrivederci."            }          ]        }      ],      "createdAt": "2024-03-06T22:08:59.643Z",      "updatedAt": "2024-03-06T22:10:21.127Z",      "publishedAt": "2024-03-06T22:10:21.130Z",      "locale": "fr"    }  ],  "meta": {    "pagination": {      "page": 1,      "pageSize": 25,      "pageCount": 1,      "total": 1    }  }}
```

### `GET` Get a document in a specific locale[](https://docs.strapi.io/cms/api/rest#rest-get "Direct link to rest-get")

To get a specific document in a given locale, add the `locale` parameter to the query:

| Use case | Syntax format and link for more information |
| --- | --- |
| In a collection type | [`GET /api/content-type-plural-name/document-id?locale=locale-code`](https://docs.strapi.io/cms/api/rest#get-one-collection-type) |
| In a single type | [`GET /api/content-type-singular-name?locale=locale-code`](https://docs.strapi.io/cms/api/rest#get-one-single-type) |

#### Collection types[](https://docs.strapi.io/cms/api/rest#get-one-collection-type "Direct link to Collection types")

To get a specific document in a collection type in a given locale, add the `locale` parameter to the query, after the `documentId`:

Example request

`GET /api/restaurants/lr5wju2og49bf820kj9kz8c3?locale=fr`

Example response

```
{  "data": [    {      "id": 22,      "documentId": "lr5wju2og49bf820kj9kz8c3",      "Name": "Biscotte Restaurant",      "Description": [        {          "type": "paragraph",          "children": [            {              "type": "text",              "text": "Bienvenue au restaurant Biscotte! Le Restaurant Biscotte propose une cuisine à base de produits frais et de qualité, souvent locaux, biologiques lorsque cela est possible, et toujours produits par des producteurs passionnés."            }          ]        }      ],      // …      "locale": "fr"    },    // …  ],  "meta": {    "pagination": {      "page": 1,      "pageSize": 25,      "pageCount": 1,      "total": 3    }  }}
```

#### Single types[](https://docs.strapi.io/cms/api/rest#get-one-single-type "Direct link to Single types")

To get a specific single type document in a given locale, add the `locale` parameter to the query, after the single type name:

Example request

`GET /api/homepage?locale=fr`

Example response

```
{  "data": {    "id": 10,    "documentId": "ukbpbnu8kbutpn98rsanyi50",    "Title": "Page d'accueil",    "Body": null,    "createdAt": "2024-03-07T13:28:26.349Z",    "updatedAt": "2024-03-07T13:28:26.349Z",    "publishedAt": "2024-03-07T13:28:26.353Z",    "locale": "fr"  },  "meta": {}}
```

### `POST` Create a new localized document for a collection type[](https://docs.strapi.io/cms/api/rest#rest-create "Direct link to rest-create")

To create a localized document from scratch, send a POST request to the Content API. Depending on whether you want to create it for the default locale or for another locale, you might need to pass the `locale` parameter in the request's body

| Use case | Syntax format and link for more information |
| --- | --- |
| Create for the default locale | [`POST /api/content-type-plural-name`](https://docs.strapi.io/cms/api/rest#rest-create-default-locale) |
| Create for a specific locale | [`POST /api/content-type-plural-name`](https://docs.strapi.io/cms/api/rest#rest-create-specific-locale)  
\+ pass locale in request body |

#### For the default locale[](https://docs.strapi.io/cms/api/rest#rest-create-default-locale "Direct link to For the default locale")

If no locale has been passed in the request body, the document is created using the default locale for the application:

Example request

`POST http://localhost:1337/api/restaurants`

```
{  "data": {    "Name": "Oplato",  }}
```

Example response

```
{  "data": {    "id": 13,    "documentId": "jae8klabhuucbkgfe2xxc5dj",    "Name": "Oplato",    "Description": null,    "createdAt": "2024-03-06T22:19:54.646Z",    "updatedAt": "2024-03-06T22:19:54.646Z",    "publishedAt": "2024-03-06T22:19:54.649Z",    "locale": "en"  },  "meta": {}}
```

#### For a specific locale[](https://docs.strapi.io/cms/api/rest#rest-create-specific-locale "Direct link to For a specific locale")

To create a localized entry for a locale different from the default one, add the `locale` attribute to the body of the POST request:

Example request

`POST http://localhost:1337/api/restaurants`

```
{  "data": {    "Name": "She's Cake",    "locale": "fr"  }}
```

Example response

```
{  "data": {    "id": 15,    "documentId": "ldcmn698iams5nuaehj69j5o",    "Name": "She's Cake",    "Description": null,    "createdAt": "2024-03-06T22:21:18.373Z",    "updatedAt": "2024-03-06T22:21:18.373Z",    "publishedAt": "2024-03-06T22:21:18.378Z",    "locale": "en"  },  "meta": {}}
```

### `PUT` Create a new, or update an existing, locale version for an existing document[](https://docs.strapi.io/cms/api/rest#rest-update "Direct link to rest-update")

With `PUT` requests sent to an existing document, you can:

-   create another locale version of the document,
-   or update an existing locale version of the document.

Send the `PUT` request to the appropriate URL, adding the `locale=your-locale-code` parameter to the query URL and passing attributes in a `data` object in the request's body:

| Use case | Syntax format and link for more information |
| --- | --- |
| In a collection type | [`PUT /api/content-type-plural-name/document-id?locale=locale-code`](https://docs.strapi.io/cms/api/rest#rest-put-collection-type) |
| In a single type | [`PUT /api/content-type-singular-name?locale=locale-code`](https://docs.strapi.io/cms/api/rest#rest-put-single-type) |

Caution

When creating a localization for existing localized entries, the body of the request can only accept localized fields.

Note

It is not possible to change the locale of an existing localized entry. When updating a localized entry, if you set a `locale` attribute in the request body it will be ignored.

#### In a collection type[](https://docs.strapi.io/cms/api/rest#rest-put-collection-type "Direct link to In a collection type")

To create a new locale for an existing document in a collection type, add the `locale` parameter to the query, after the `documentId`, and pass data to the request's body:

Example request: Creating a French locale for an existing restaurant

`PUT http://localhost:1337/api/restaurants/lr5wju2og49bf820kj9kz8c3?locale=fr`

```
{  data: {    "Name": "She's Cake in French",  }}
```

Example response

```
{  "data": {    "id": 19,    "documentId": "lr5wju2og49bf820kj9kz8c3",    "Name": "She's Cake in French",    "Description": null,    "createdAt": "2024-03-07T12:13:09.551Z",    "updatedAt": "2024-03-07T12:13:09.551Z",    "publishedAt": "2024-03-07T12:13:09.554Z",    "locale": "fr"  },  "meta": {}}
```

#### In a single type[](https://docs.strapi.io/cms/api/rest#rest-put-single-type "Direct link to In a single type")

To create a new locale for an existing single type document, add the `locale` parameter to the query, after the single type name, and pass data to the request's body:

Example: Create a FR locale for an existing Homepage single type

`PUT http://localhost:1337/api/homepage?locale=fr`

```
{  "data": {    "Title": "Page d'accueil"  }}
```

Example response

```
{  "data": {    "id": 10,    "documentId": "ukbpbnu8kbutpn98rsanyi50",    "Title": "Page d'accueil",    "Body": null,    "createdAt": "2024-03-07T13:28:26.349Z",    "updatedAt": "2024-03-07T13:28:26.349Z",    "publishedAt": "2024-03-07T13:28:26.353Z",    "locale": "fr"  },  "meta": {}}
```

  

### `DELETE` Delete a locale version of a document[](https://docs.strapi.io/cms/api/rest#rest-delete "Direct link to rest-delete")

To delete a locale version of a document, send a `DELETE` request with the appropriate `locale` parameter.

`DELETE` requests only send a 204 HTTP status code on success and do not return any data in the response body.

#### In a collection type[](https://docs.strapi.io/cms/api/rest#rest-delete-collection-type "Direct link to In a collection type")

To delete only a specific locale version of a document in a collection type, add the `locale` parameter to the query after the `documentId`:

Example request

`DELETE /api/restaurants/abcdefghijklmno456?locale=fr`

#### In a single type[](https://docs.strapi.io/cms/api/rest#rest-delete-single-type "Direct link to In a single type")

To delete only a specific locale version of a single type document, add the `locale` parameter to the query after the single type name:

Example request

`DELETE /api/homepage?locale=fr`