## REST API: Population & Field Selection

The [REST API](https://docs.strapi.io/cms/api/rest) by default does not populate any relations, media fields, components, or dynamic zones. Use the [`populate` parameter](https://docs.strapi.io/cms/api/rest#population) to populate specific fields and the [`select` parameter](https://docs.strapi.io/cms/api/rest#field-selection) to return only specific fields with the query results.

Tip

Strapi takes advantage of the ability of [the \`qs\` library](https://github.com/ljharb/qs) to parse nested objects to create more complex queries.

Use `qs` directly to generate complex queries instead of creating them manually. Examples in this documentation showcase how you can use `qs`.

You can also use the [interactive query builder](https://docs.strapi.io/cms/api/rest/interactive-query-builder) if you prefer playing with our online tool instead of generating queries with `qs` on your machine.

🏗 Work-in-progress

Strapi v4 docs very recently included a more extensive description of how to use the `populate` parameter, including an [extensive API reference](https://docs.strapi.io/cms/api/rest/populate-select#population) and [additional guides](https://docs.strapi.io/cms/api/rest/guides/intro). These v4 pages are currently being ported and adapted to Strapi 5 docs so that examples reflect the new data response format.

In the meantime, you can trust the content of the present page as accurate as it already reflects the new Strapi 5, flattened response format (see [breaking change entry](https://docs.strapi.io/cms/migration/v4-to-v5/breaking-changes/new-response-format) and [REST API introduction](https://docs.strapi.io/cms/api/rest#requests) for details); the present page is just not as complete as its v4 equivalent yet.

## Field selection[](https://docs.strapi.io/cms/api/rest#field-selection "Direct link to Field selection")

Queries can accept a `fields` parameter to select only some fields. By default, only the following [types of fields](https://docs.strapi.io/cms/backend-customization/models#model-attributes) are returned:

-   string types: string, text, richtext, enumeration, email, password, and uid,
-   date types: date, time, datetime, and timestamp,
-   number types: integer, biginteger, float, and decimal,
-   generic types: boolean, array, and JSON.

| Use case | Example parameter syntax |
| --- | --- |
| Select a single field | `fields=name` |
| Select multiple fields | `fields[0]=name&fields[1]=description` |

Note

Field selection does not work on relational, media, component, or dynamic zone fields. To populate these fields, use the [`populate` parameter](https://docs.strapi.io/cms/api/rest#population).

Example request: Return only name and description fields

`GET /api/restaurants?fields[0]=name&fields[1]=description`

JavaScript query (built with the qs library):

Example response

```
{  "data": [    {      "id": 4,      "Name": "Pizzeria Arrivederci",      "Description": [        {          "type": "paragraph",          "children": [            {              "type": "text",              "text": "Specialized in pizza, we invite you to rediscover our classics, such as 4 Formaggi or Calzone, and our original creations such as Do Luigi or Nduja."            }          ]        }      ],      "documentId": "lr5wju2og49bf820kj9kz8c3"    },    // …  ],  "meta": {    "pagination": {      "page": 1,      "pageSize": 25,      "pageCount": 1,      "total": 4    }  }}
```

## Population[](https://docs.strapi.io/cms/api/rest#population "Direct link to Population")

The REST API by default does not populate any type of fields, so it will not populate relations, media fields, components, or dynamic zones unless you pass a `populate` parameter to populate various field types.

The `populate` parameter can be used alone or [in combination with with multiple operators](https://docs.strapi.io/cms/api/rest#combining-population-with-other-operators) to have much more control over the population.

Caution

The `find` permission must be enabled for the content-types that are being populated. If a role doesn't have access to a content-type it will not be populated (see [User Guide](https://docs.strapi.io/cms/features/users-permissions#editing-a-role) for additional information on how to enable `find` permissions for content-types).

Note

It's currently not possible to return just an array of ids with a request.

Populating guides

The [REST API guides](https://docs.strapi.io/cms/api/rest/guides/intro) section includes more detailed information about various possible use cases for the populate parameter:

-   The [Understanding populate](https://docs.strapi.io/cms/api/rest/guides/understanding-populate) guide explains in details how populate works, with diagrams, comparisons, and real-world examples.
-   The [How to populate creator fields](https://docs.strapi.io/cms/api/rest/guides/populate-creator-fields) guide provides step-by-step instructions on how to add `createdBy` and `updatedBy` fields to your queries responses.

The following table sums up possible populate use cases and their associated parameter syntaxes, and links to sections of the Understanding populate guide which includes more detailed explanations:

| Use case | Example parameter syntax | Detailed explanations to read |
| --- | --- | --- |
| Populate everything, 1 level deep, including media fields, relations, components, and dynamic zones | `populate=*` | [Populate all relations and fields, 1 level deep](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-all-relations-and-fields-1-level-deep) |
| Populate one relation,  
1 level deep | `populate=a-relation-name` | [Populate 1 level deep for specific relations](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-1-level-deep-for-specific-relations) |
| Populate several relations,  
1 level deep | `populate[0]=relation-name&populate[1]=another-relation-name&populate[2]=yet-another-relation-name` | [Populate 1 level deep for specific relations](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-1-level-deep-for-specific-relations) |
| Populate some relations, several levels deep | `populate[root-relation-name][populate][0]=nested-relation-name` | [Populate several levels deep for specific relations](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-several-levels-deep-for-specific-relations) |
| Populate a component | `populate[0]=component-name` | [Populate components](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-components) |
| Populate a component and one of its nested components | `populate[0]=component-name&populate[1]=component-name.nested-component-name` | [Populate components](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-components) |
| Populate a dynamic zone (only its first-level elements) | `populate[0]=dynamic-zone-name` | [Populate dynamic zones](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-dynamic-zones) |
| Populate a dynamic zone and its nested elements and relations, using a precisely defined, detailed population strategy | `populate[dynamic-zone-name][on][component-category.component-name][populate][relation-name][populate][0]=field-name` | [Populate dynamic zones](https://docs.strapi.io/cms/api/rest/guides/understanding-populate#populate-dynamic-zones) |

### Combining Population with other operators[](https://docs.strapi.io/cms/api/rest#combining-population-with-other-operators "Direct link to Combining Population with other operators")

By utilizing the `populate` operator it is possible to combine other operators such as [field selection](https://docs.strapi.io/cms/api/rest/populate-select#field-selection), [filters](https://docs.strapi.io/cms/api/rest/filters), and [sort](https://docs.strapi.io/cms/api/rest/sort-pagination) in the population queries.

Caution

The population and pagination operators cannot be combined.

#### Populate with field selection[](https://docs.strapi.io/cms/api/rest#populate-with-field-selection "Direct link to Populate with field selection")

`fields` and `populate` can be combined.

Example request

`GET /api/articles?fields[0]=title&fields[1]=slug&populate[headerImage][fields][0]=name&populate[headerImage][fields][1]=url`

JavaScript query (built with the qs library):

Example response

```
{  "data": [    {      "id": 1,      "documentId": "h90lgohlzfpjf3bvan72mzll",      "title": "Test Article",      "slug": "test-article",      "headerImage": {        "id": 1,        "documentId": "cf07g1dbusqr8mzmlbqvlegx",        "name": "17520.jpg",        "url": "/uploads/17520_73c601c014.jpg"      }    }  ],  "meta": {    // ...  }}
```

#### Populate with filtering[](https://docs.strapi.io/cms/api/rest#populate-with-filtering "Direct link to Populate with filtering")

`filters` and `populate` can be combined.

Example request

`GET /api/articles?populate[categories][sort][0]=name%3Aasc&populate[categories][filters][name][$eq]=Cars`

JavaScript query (built with the qs library):

Example response

```
{  "data": [    {      "id": 1,      "documentId": "a1b2c3d4e5d6f7g8h9i0jkl",      "title": "Test Article",      // ...      "categories": {        "data": [          {            "id": 2,            "documentId": "jKd8djla9ndalk98hflj3",            "name": "Cars"            // ...          }        ]        }      }    }  ],  "meta": {    // ...  }}
```