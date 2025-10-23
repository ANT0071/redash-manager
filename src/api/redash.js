/**
 * @typedef {Object} RedashQuery
 * @property {number} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} query
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} data_source_id
 * @property {number} user_id
 * @property {boolean} [is_archived]
 * @property {boolean} [is_draft]
 * @property {string[]} [tags]
 */

/**
 * Redash API Client
 * Uses native fetch API available in Node.js 24
 */
export class RedashClient {
  /**
   * @param {string} baseUrl
   * @param {string} apiKey
   */
  constructor(baseUrl, apiKey) {
    if (!baseUrl || !apiKey) {
      throw new Error('REDASH_URL and REDASH_API_KEY must be provided');
    }

    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the Redash API
   * @param {string} endpoint
   * @param {RequestInit} [options]
   * @returns {Promise<any>}
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Redash API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Fetch all queries continuously using async generator
   * Yields queries as they're being fetched (with pagination support)
   * @returns {AsyncGenerator<RedashQuery, void, unknown>}
   */
  async *getAllQueries() {
    let page = 1;
    const pageSize = 100;

    while (true) {
      const data = await this.request(
        `/queries/my?order=created_at&page=${page}&page_size=${pageSize}`
      );

      if (!data.results || data.results.length === 0) {
        break;
      }

      // Yield queries as they're fetched
      for (const query of data.results) {
        yield query;
      }

      // Check if there are more pages
      if (data.results.length < pageSize) {
        break;
      }

      page++;
    }
  }

  /**
   * Fetch a single query by ID with full details
   * @param {number} queryId
   * @returns {Promise<RedashQuery>}
   */
  async getQuery(queryId) {
    return this.request(`/queries/${queryId}`);
  }

  /**
   * Update a query's SQL content
   * @param {number} queryId
   * @param {string} sqlContent
   * @returns {Promise<RedashQuery>}
   */
  async updateQuery(queryId, sqlContent) {
    return this.request(`/queries/${queryId}`, {
      method: 'POST',
      body: JSON.stringify({ query: sqlContent }),
    });
  }
}

/**
 * Create a Redash client from environment variables
 * @returns {RedashClient}
 */
export function createClient() {
  const baseUrl = process.env.REDASH_URL;
  const apiKey = process.env.REDASH_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      'REDASH_URL and REDASH_API_KEY environment variables must be set'
    );
  }

  return new RedashClient(baseUrl, apiKey);
}
