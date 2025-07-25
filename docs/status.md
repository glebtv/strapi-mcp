REST API: status

The REST API offers the ability to filter results based on their status, draft or published.
Prerequisites

The Draft & Publish feature should be enabled.

Queries can accept a status parameter to fetch documents based on their status:

    published: returns only the published version of documents (default)
    draft: returns only the draft version of documents

Tip

In the response data, the publishedAt field is null for drafts.
Note

Since published versions are returned by default, passing no status parameter is equivalent to passing status=published.


Get draft versions of restaurants

GET /api/articles?status=draft

```
{  "data": [    // …    {      "id": 5,      "documentId": "znrlzntu9ei5onjvwfaalu2v",      "Name": "Biscotte Restaurant",      "Description": [        {          "type": "paragraph",          "children": [            {              "type": "text",              "text": "This is the draft version."            }          ]        }      ],      "createdAt": "2024-03-06T13:43:30.172Z",      "updatedAt": "2024-03-06T21:38:46.353Z",      "publishedAt": null,      "locale": "en"    },    // …  ],  "meta": {    "pagination": {      "page": 1,      "pageSize": 25,      "pageCount": 1,      "total": 4    }  }}
```