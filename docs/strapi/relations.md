## Managing relations with API requests

Defining relations between content-types (that are designated as entities in the database layers) is connecting entities with each other.

Relations between content-types can be managed through the [admin panel](https://docs.strapi.io/cms/features/content-manager#relational-fields) or through [REST API](https://docs.strapi.io/cms/api/rest) or [Document Service API](https://docs.strapi.io/cms/api/document-service) requests.

Relations can be connected, disconnected or set through the Content API by passing parameters in the body of the request:

| Parameter name | Description | Type of update |
| --- | --- | --- |
| [`connect`](https://docs.strapi.io/cms/api/rest#connect) | Connects new entities.
Can be used in combination with `disconnect`.

Can be used with [positional arguments](https://docs.strapi.io/cms/api/rest#relations-reordering) to define an order for relations.

 | Partial |
| [`disconnect`](https://docs.strapi.io/cms/api/rest#disconnect) | Disconnects entities.

Can be used in combination with `connect`.

 | Partial |
| [`set`](https://docs.strapi.io/cms/api/rest#set) | Set entities to a specific set. Using `set` will overwrite all existing connections to other entities.

Cannot be used in combination with `connect` or `disconnect`.

 | Full |

Note

When [Internationalization (i18n)](https://docs.strapi.io/cms/features/internationalization) is enabled on the content-type, you can also pass a locale to set relations for a specific locale, as in this Document Service API example:

```
await strapi.documents('api::restaurant.restaurant').update({   documentId: 'a1b2c3d4e5f6g7h8i9j0klm',  locale: 'fr',  data: {     category: {      connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']    }  }})
```

If no locale is passed, the default locale will be assumed.

## `connect`[](https://docs.strapi.io/cms/api/rest#connect "Direct link to connect")

Using `connect` in the body of a request performs a partial update, connecting the specified relations.

`connect` accepts either a shorthand or a longhand syntax:

| Syntax type | Syntax example |
| --- | --- |
| shorthand | `connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']` |
| longhand | `connect: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }]` |

You can also use the longhand syntax to [reorder relations](https://docs.strapi.io/cms/api/rest#relations-reordering).

`connect` can be used in combination with [`disconnect`](https://docs.strapi.io/cms/api/rest#disconnect).

Caution

`connect` can not be used for media attributes

-   Shorthand syntax example
-   Longhand syntax example

Sending the following request updates a `restaurant`, identified by its `documnentId` `a1b2c3d4e5f6g7h8i9j0klm`. The request uses the `categories` attribute to connect the restaurant with 2 categories identified by their `documentId`:

Example REST request

`PUT` `http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```
{  data: {    categories: {      connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']    }  }}
```

Example Node request

```
const fetch = require('node-fetch');const response = await fetch(  'http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm',  {    method: 'put',    body: {      data: {        categories: {          connect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']        }      }    }  });
```

### Relations reordering[](https://docs.strapi.io/cms/api/rest#relations-reordering "Direct link to Relations reordering")

4.6.0This feature requires Strapi version 4.6.0 or later.

Positional arguments can be passed to the longhand syntax of `connect` to define the order of relations.

The longhand syntax accepts an array of objects, each object containing the `documentId` of the entry to be connected and an optional `position` object to define where to connect the relation.

Different syntaxes for different relations

The syntaxes described in this documentation are useful for one-to-many, many-to-many and many-ways relations.  
For one-to-one, many-to-one and one-way relations, the syntaxes are also supported but only the last relation will be used, so it's preferable to use a shorter format (e.g.: `{ data: { category: 'a1b2c3d4e5f6g7h8i9j0klm' } }`, see [REST API documentation](https://docs.strapi.io/cms/api/rest#requests)).

To define the `position` for a relation, pass one of the following 4 different positional attributes:

| Parameter name and syntax | Description | Type |
| --- | --- | --- |
| `before: documentId` | Positions the relation before the given `documentId`. | `documentId` (string) |
| `after: documentId` | Positions the relation after the given `documentId`. | `documentId` (string) |
| `start: true` | Positions the relation at the start of the existing list of relations. | Boolean |
| `end: true` | Positions the relation at the end of the existing list of relations. | Boolean |

The `position` argument is optional and defaults to `position: { end: true }`.

Sequential order

Since `connect` is an array, the order of operations is important as they will be treated sequentially (see combined example below).

Caution

The same relation should not be connected more than once, otherwise it would return a Validation error by the API.

-   Basic example
-   Combined example

Consider the following record in the database:

```
categories: [  { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }  { documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }]
```

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, connecting a relation of entity with a `documentId` of `ma12bc34de56fg78hi90jkl` for the `categories` attribute and positioning it before the entity with `documentId` `z0y2x4w6v8u1t3s5r7q9onm`:

Example request to update the position of one relation

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```
{  data: {    categories: {      connect: [        { documentId: 'ma12bc34de56fg78hi90jkl', position: { before: 'z0y2x4w6v8u1t3s5r7q9onm' } },      ]    }  }}
```

### Edge cases: Draft & Publish or i18n disabled[](https://docs.strapi.io/cms/api/rest#edge-cases-draft--publish-or-i18n-disabled "Direct link to Edge cases: Draft & Publish or i18n disabled")

When some built-in features of Strapi 5 are disabled for a content-type, such as [Draft & Publish](https://docs.strapi.io/cms/features/draft-and-publish) and [Internationalization (i18)](https://docs.strapi.io/cms/features/internationalization), the `connect` parameter might be used differently:

**Relation from a `Category` with i18n _off_ to an `Article` with i18n _on_:**

In this situation you can select which locale you are connecting to:

```
data: {    categories: {      connect: [        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', locale: 'en' },        // Connect to the same document id but with a different locale 👇        { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', locale: 'fr' },      ]   }}
```

**Relation from a `Category` with Draft & Publish _off_ to an `Article` with Draft & Publish _on_:**

```
data: {  categories: {    connect: [      { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', status: 'draft' },      // Connect to the same document id but with different publication states 👇      { documentId: 'z0y2x4w6v8u1t3s5r7q9onm', status: 'published' },    ]  }}
```

## `disconnect`[](https://docs.strapi.io/cms/api/rest#disconnect "Direct link to disconnect")

Using `disconnect` in the body of a request performs a partial update, disconnecting the specified relations.

`disconnect` accepts either a shorthand or a longhand syntax:

| Syntax type | Syntax example |
| --- | --- |
| shorthand | `disconnect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']` |
| longhand | `disconnect: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }]` |

`disconnect` can be used in combination with [`connect`](https://docs.strapi.io/cms/api/rest#connect).

  

-   Shorthand syntax example
-   Longhand syntax example

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, disconnecting the relations with 2 entries identified by their `documentId`:

Example request using the shorthand syntax

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```
{  data: {    categories: {      disconnect: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv'],    }  }}
```

## `set`[](https://docs.strapi.io/cms/api/rest#set "Direct link to set")

Using `set` performs a full update, replacing all existing relations with the ones specified, in the order specified.

`set` accepts a shorthand or a longhand syntax:

| Syntax type | Syntax example |
| --- | --- |
| shorthand | `set: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv']` |
| longhand | `set: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }]` |

As `set` replaces all existing relations, it should not be used in combination with other parameters. To perform a partial update, use [`connect`](https://docs.strapi.io/cms/api/rest#connect) and [`disconnect`](https://docs.strapi.io/cms/api/rest#disconnect).

Omitting set

Omitting any parameter is equivalent to using `set`.  
For instance, the following 3 syntaxes are all equivalent:

-   `data: { categories: set: [{ documentId: 'z0y2x4w6v8u1t3s5r7q9onm' }, { documentId: 'j9k8l7m6n5o4p3q2r1s0tuv' }] }}`
-   `data: { categories: set: ['z0y2x4w6v8u1t3s5r7q9onm2', 'j9k8l7m6n5o4p3q2r1s0tuv'] }}`
-   `data: { categories: ['z0y2x4w6v8u1t3s5r7q9onm2', 'j9k8l7m6n5o4p3q2r1s0tuv'] }`

-   Shorthand syntax example
-   Longhand syntax example

Sending the following request updates a `restaurant`, identified by its `documentId` `a1b2c3d4e5f6g7h8i9j0klm`, replacing all previously existing relations and using the `categories` attribute to connect 2 categories identified by their `documentId`:

Example request using the shorthand syntax with set

`PUT http://localhost:1337/api/restaurants/a1b2c3d4e5f6g7h8i9j0klm`

```
{  data: {    categories: {      set: ['z0y2x4w6v8u1t3s5r7q9onm', 'j9k8l7m6n5o4p3q2r1s0tuv4'],    }  }}
```