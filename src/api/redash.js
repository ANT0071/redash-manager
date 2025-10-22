/**
 * Redash API Client
 * Uses native fetch API available in Node.js 24
 */

export class RedashClient {
  constructor(baseUrl, apiKey) {
    if (!baseUrl || !apiKey) {
      throw new Error('REDASH_URL and REDASH_API_KEY must be provided');
    }

    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the Redash API
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}/api${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
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
   * Fetch all queries (with pagination support)
   */
  async getAllQueries() {
    const queries = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const data = await this.request(
        `/queries?page=${page}&page_size=${pageSize}`
      );

      if (!data.results || data.results.length === 0) {
        break;
      }

      queries.push(...data.results);

      // Check if there are more pages
      if (data.results.length < pageSize) {
        break;
      }

      page++;
    }

    return queries;
  }

  /**
   * Fetch a single query by ID with full details
   */
  async getQuery(queryId) {
    return this.request(`/queries/${queryId}`);
  }
}

/**
 * Create a Redash client from environment variables
 */
export function createClient() {
  const baseUrl = process.env.REDASH_URL;
  const apiKey = process.env.REDASH_API_KEY;

  return new RedashClient(baseUrl, apiKey);
}
