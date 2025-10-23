/**
 * Query downloader service
 */

import { createClient } from '../api/redash.js';
import { hashQuery, generateHash } from './hash.js';
import {
  ensureQueriesDir,
  saveQuery,
  readQueryMetadata,
  readQuerySql,
} from '../utils/fileManager.js';
import readline from 'readline';

/**
 * @typedef {import('../api/redash.js').RedashQuery} RedashQuery
 * @typedef {import('../utils/fileManager.js').QueryMetadata} QueryMetadata
 */

/**
 * Prompt user for confirmation
 * @param {string} question
 * @returns {Promise<boolean>}
 */
async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

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
  let updatedFromRemote = 0;
  let updatedToRemote = 0;
  let conflicts = 0;
  let total = 0;

  // Process queries as they're being fetched using async generator
  for await (const query of client.getAllQueries()) {
    total++;
    const queryId = query.id;
    const remoteSqlContent = query.query || '';
    const remoteHash = hashQuery(query);

    // Check if query exists locally
    const existingMetadata = await readQueryMetadata(queryId);

    if (!existingMetadata) {
      // New query - download it
      downloaded++;
      console.log(`  [NEW] Query ${queryId}: ${query.name}`);
      const metadata = buildMetadata(query, remoteHash);
      await saveQuery(queryId, remoteSqlContent, metadata);
      continue;
    }

    // Query exists locally - perform three-way comparison
    const cachedHash = existingMetadata.hash;
    const localSqlContent = await readQuerySql(queryId);
    const localHash = localSqlContent ? generateHash(localSqlContent) : null;

    // Three-way hash comparison
    if (localHash === cachedHash && cachedHash === remoteHash) {
      // All hashes equal - nothing to do
      skipped++;
      console.log(`  [SKIP] Query ${queryId}: ${query.name} (unchanged)`);
      continue;
    } else if (localHash === cachedHash && cachedHash !== remoteHash) {
      // Local and cached match, but remote changed - download remote
      updatedFromRemote++;
      console.log(
        `  [REMOTE→LOCAL] Query ${queryId}: ${query.name} (remote updated)`
      );
      const metadata = buildMetadata(query, remoteHash);
      await saveQuery(queryId, remoteSqlContent, metadata);
      continue;
    } else if (cachedHash === remoteHash && localHash !== cachedHash) {
      // Cached and remote match, but local changed - offer to upload
      console.log(
        `  [LOCAL MODIFIED] Query ${queryId}: ${query.name} (local changes detected)`
      );
      const shouldUpload = await promptUser(
        `Upload local changes to remote for query ${queryId}?`
      );

      if (shouldUpload && localSqlContent) {
        try {
          const updatedQuery = await client.updateQuery(
            queryId,
            localSqlContent
          );
          const newRemoteHash = hashQuery(updatedQuery);
          const metadata = buildMetadata(updatedQuery, newRemoteHash);
          await saveQuery(queryId, localSqlContent, metadata);
          updatedToRemote++;
          console.log(
            `  [LOCAL→REMOTE] Query ${queryId}: ${query.name} uploaded`
          );
        } catch (error) {
          console.error(
            `  [ERROR] Failed to upload query ${queryId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else {
        console.log(`  [SKIP] Query ${queryId}: Upload declined`);
        skipped++;
      }
      continue;
    } else {
      // All three differ - conflict
      conflicts++;
      console.log(
        `  [CONFLICT] Query ${queryId}: ${query.name} (local, cached, and remote all differ)`
      );
      console.log(`    Local hash:  ${localHash || 'null'}`);
      console.log(`    Cached hash: ${cachedHash}`);
      console.log(`    Remote hash: ${remoteHash}`);
      console.log(`    Keeping local version. Manual resolution required.`);
      continue;
    }
  }

  console.log('\nSync complete:');
  console.log(`  New: ${downloaded}`);
  console.log(`  Updated from remote: ${updatedFromRemote}`);
  console.log(`  Updated to remote: ${updatedToRemote}`);
  console.log(`  Skipped (unchanged): ${skipped}`);
  console.log(`  Conflicts: ${conflicts}`);
  console.log(`  Total: ${total}`);
}
