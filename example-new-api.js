// Example of the NEW get_entries API with direct typed parameters
// NO MORE JSON.stringify!

const exampleUsage = {
  // ======================================
  // SIMPLE QUERY - Just get all entries
  // ======================================
  simple: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article'
    }
  },

  // ======================================
  // WITH FILTERS - Direct object, no stringify!
  // ======================================
  withFilters: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      filters: {
        title: { $contains: 'JavaScript' },
        published_at: { $notNull: true }
      }
    }
  },

  // ======================================
  // COMPLEX FILTERS with $and, $or
  // ======================================
  complexFilters: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::product.product',
      filters: {
        $or: [
          { price: { $lt: 100 } },
          { 
            $and: [
              { category: { $eq: 'electronics' } },
              { featured: { $eq: true } }
            ]
          }
        ]
      }
    }
  },

  // ======================================
  // WITH PAGINATION - Direct object
  // ======================================
  withPagination: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::post.post',
      pagination: {
        page: 2,
        pageSize: 20
      }
    }
  },

  // ======================================
  // WITH POPULATION - String or object
  // ======================================
  populateAll: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      populate: '*'  // Populate everything
    }
  },

  populateSpecific: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      populate: ['author', 'categories', 'cover']  // Array of fields
    }
  },

  populateNested: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      populate: {
        author: {
          populate: ['avatar', 'bio']
        },
        categories: {
          fields: ['name', 'slug']
        },
        sections: {
          populate: '*'  // Required for dynamic zones
        }
      }
    }
  },

  // ======================================
  // WITH FIELD SELECTION
  // ======================================
  withFields: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      fields: ['title', 'slug', 'publishedAt']
    }
  },

  // ======================================
  // WITH SORTING - String or array
  // ======================================
  withSort: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      sort: 'createdAt:DESC'  // Single sort
    }
  },

  withMultiSort: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      sort: ['featured:DESC', 'createdAt:DESC']  // Multiple sorts
    }
  },

  // ======================================
  // WITH LOCALE
  // ======================================
  withLocale: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::page.page',
      locale: 'fr'  // Get French version
    }
  },

  allLocales: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::page.page',
      locale: 'all'  // Get all locales
    }
  },

  // ======================================
  // WITH STATUS (Draft & Publish)
  // ======================================
  publishedOnly: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      status: 'published'
    }
  },

  draftsOnly: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      status: 'draft'
    }
  },

  // ======================================
  // COMPLETE EXAMPLE - All parameters
  // ======================================
  complete: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      
      // Filters - direct object
      filters: {
        $and: [
          { category: { $in: ['tech', 'science'] } },
          { featured: { $eq: true } },
          { publishedAt: { $gte: '2024-01-01' } }
        ]
      },
      
      // Population - complex nested
      populate: {
        author: {
          fields: ['name', 'email'],
          populate: {
            avatar: {
              fields: ['url', 'alternativeText']
            }
          }
        },
        categories: '*',
        tags: {
          sort: 'name:ASC'
        }
      },
      
      // Field selection
      fields: ['title', 'slug', 'excerpt', 'publishedAt'],
      
      // Pagination
      pagination: {
        page: 1,
        pageSize: 10
      },
      
      // Sorting
      sort: ['featured:DESC', 'publishedAt:DESC'],
      
      // Locale
      locale: 'en',
      
      // Status
      status: 'published'
    }
  },

  // ======================================
  // DOCUMENT ID FILTER (Special case)
  // ======================================
  byDocumentId: {
    name: 'get_entries',
    arguments: {
      contentTypeUid: 'api::article.article',
      documentId: 'abc123def456',  // Gets combined with filters using $and
      locale: 'en'
    }
  }
};

console.log('New get_entries API Examples:');
console.log('==============================');
console.log('No more JSON.stringify! All parameters are now direct, typed objects.');
console.log('');
console.log('Benefits:');
console.log('- ✅ Full TypeScript/IDE support');
console.log('- ✅ Better error messages');
console.log('- ✅ Cleaner, more readable code');
console.log('- ✅ Direct alignment with Strapi REST API');
console.log('');
console.log('Old format with options: JSON.stringify() is NO LONGER SUPPORTED!');