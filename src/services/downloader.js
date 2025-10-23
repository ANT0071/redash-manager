/**
 * Query downloader service
 */

import { createClient } from '../api/redash.js';
import { hashQuery } from './hash.js';
import {
  ensureQueriesDir,
  saveQuery,
  readQueryMetadata,
} from '../utils/fileManager.js';

/**
 * @typedef {import('../api/redash.js').RedashQuery} RedashQuery
 * @typedef {import('../utils/fileManager.js').QueryMetadata} QueryMetadata
 */

/**
 * Build metadata object for a query
 * @param {RedashQuery} query
 * @param {string} hash
 * @returns {QueryMetadata}
 */
function buildMetadata(query, hash) {
  return {
    id: query.id,
    name: query.name,
    description: query.description || '',
    created_at: query.created_at,
    updated_at: query.updated_at,
    data_source_id: query.data_source_id,
    user_id: query.user_id,
    is_archived: query.is_archived || false,
    is_draft: query.is_draft || false,
    tags: query.tags || [],
    hash,
    downloaded_at: new Date().toISOString(),
  };
}

/**
 * Download all queries from Redash
 * @returns {Promise<void>}
 */
export async function downloadQueries() {
  console.log('Connecting to Redash API...');

  const client = createClient();

  // Ensure queries directory exists
  await ensureQueriesDir();

  console.log('Fetching queries...');

  let downloaded = 0;
  let skipped = 0;
  let updated = 0;
  let total = 0;

  // Process queries as they're being fetched using async generator
  for await (const query of client.getAllQueries()) {
    total++;
    const queryId = query.id;
    const sqlContent = query.query || '';
    const currentHash = hashQuery(query);

    // Check if query exists locally
    const existingMetadata = await readQueryMetadata(queryId);

    if (existingMetadata) {
      // Compare hashes to see if query has changed
      if (existingMetadata.hash === currentHash) {
        skipped++;
        console.log(`  [SKIP] Query ${queryId}: ${query.name} (unchanged)`);
        continue;
      } else {
        updated++;
        console.log(`  [UPDATE] Query ${queryId}: ${query.name}`);
      }
    } else {
      downloaded++;
      console.log(`  [NEW] Query ${queryId}: ${query.name}`);
    }

    // Build metadata
    const metadata = buildMetadata(query, currentHash);

    // Save to filesystem
    await saveQuery(queryId, sqlContent, metadata);
  }

  console.log('\nDownload complete:');
  console.log(`  New: ${downloaded}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (unchanged): ${skipped}`);
  console.log(`  Total: ${total}`);
}
