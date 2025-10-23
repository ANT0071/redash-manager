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
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * @typedef {import('../api/redash.js').RedashQuery} RedashQuery
 * @typedef {import('../utils/fileManager.js').QueryMetadata} QueryMetadata
 */

/**
 * @typedef {'yes' | 'skip' | 'yes-all' | 'skip-all' | 'quit'} PromptResponse
 */

/**
 * @typedef {'local' | 'remote' | 'skip' | 'local-all' | 'remote-all'} ConflictResponse
 */

/**
 * Show diff between local and remote content using git diff or diff command
 * @param {string} localContent
 * @param {string} remoteContent
 * @param {string} label
 * @returns {Promise<void>}
 */
async function showDiff(localContent, remoteContent, label) {
  // Create temporary files for diffing
  const tmpDir = os.tmpdir();
  const localFile = path.join(tmpDir, `redash-local-${Date.now()}.sql`);
  const remoteFile = path.join(tmpDir, `redash-remote-${Date.now()}.sql`);

  try {
    await fs.writeFile(localFile, localContent, 'utf8');
    await fs.writeFile(remoteFile, remoteContent, 'utf8');

    console.log(`\n  [DIFF] Changes for ${label}:`);

    // Try git diff first, then fall back to diff
    const diffCommand = await new Promise((resolve) => {
      const gitTest = spawn('git', ['--version']);
      gitTest.on('close', (code) => {
        resolve(code === 0 ? 'git' : 'diff');
      });
      gitTest.on('error', () => resolve('diff'));
    });

    return new Promise((resolve) => {
      const args =
        diffCommand === 'git'
          ? [
              'diff',
              '--no-index',
              '--color=always',
              '--',
              remoteFile,
              localFile,
            ]
          : ['-u', remoteFile, localFile];

      const proc = spawn(diffCommand, args);

      proc.stdout.on('data', (data) => {
        // Filter out the temp file paths from diff output
        const output = data
          .toString()
          .split('\n')
          .filter(
            /** @param {string} line */
            (line) => {
              // Skip lines that show temp file paths
              return !(
                line.startsWith('---') ||
                line.startsWith('+++') ||
                line.startsWith('diff --git')
              );
            }
          )
          .join('\n');

        if (output.trim()) {
          process.stdout.write(output);
        }
      });

      proc.stderr.on('data', (_data) => {
        // Ignore stderr for diff (exit code 1 is normal when files differ)
      });

      proc.on('close', async () => {
        // Clean up temp files
        try {
          await fs.unlink(localFile);
          await fs.unlink(remoteFile);
        } catch (error) {
          // Ignore cleanup errors
        }
        console.log(''); // Add blank line after diff
        resolve();
      });
    });
  } catch (error) {
    // If diff fails, just continue without showing it
    console.log(
      `  [DIFF] Could not generate diff: ${error instanceof Error ? error.message : String(error)}`
    );
    // Clean up temp files on error
    try {
      await fs.unlink(localFile);
      await fs.unlink(remoteFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Prompt user for confirmation with support for batch operations
 * @param {string} question
 * @returns {Promise<PromptResponse>}
 */
async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question}\n(yes/skip/yes-all/skip-all/quit): `, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();

      if (normalized === 'yes') {
        resolve('yes');
      } else if (normalized === 'skip' || normalized === '') {
        resolve('skip');
      } else if (normalized === 'yes-all') {
        resolve('yes-all');
      } else if (normalized === 'skip-all') {
        resolve('skip-all');
      } else if (normalized === 'quit') {
        resolve('quit');
      } else {
        // Invalid input, default to 'skip'
        resolve('skip');
      }
    });
  });
}

/**
 * Prompt user for conflict resolution
 * @param {string} question
 * @returns {Promise<ConflictResponse>}
 */
async function promptConflict(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `${question}\n(local/remote/skip/local-all/remote-all): `,
      (answer) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();

        if (normalized === 'local') {
          resolve('local');
        } else if (normalized === 'remote') {
          resolve('remote');
        } else if (normalized === 'skip' || normalized === '') {
          resolve('skip');
        } else if (normalized === 'local-all') {
          resolve('local-all');
        } else if (normalized === 'remote-all') {
          resolve('remote-all');
        } else {
          // Invalid input, default to 'skip'
          resolve('skip');
        }
      }
    );
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

  // Batch operation state
  /** @type {PromptResponse | null} */
  let batchMode = null;
  /** @type {ConflictResponse | null} */
  let conflictBatchMode = null;
  let userQuit = false;

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

      // Determine if we should upload based on batch mode or prompt
      let shouldUpload = false;

      if (batchMode === 'yes-all') {
        shouldUpload = true;
        console.log(`  [AUTO] Uploading (batch mode: yes-all)`);
      } else if (batchMode === 'skip-all') {
        shouldUpload = false;
        console.log(`  [AUTO] Skipping (batch mode: skip-all)`);
      } else if (!userQuit) {
        // Show diff before prompting
        if (localSqlContent) {
          await showDiff(
            localSqlContent,
            remoteSqlContent,
            `Query ${queryId}: ${query.name}`
          );
        }

        const queryUrl = `${client.baseUrl}/queries/${queryId}/source`;
        const response = await promptUser(
          `Upload local changes to remote? ${queryUrl}`
        );

        if (response === 'quit') {
          console.log(`\n[QUIT] User requested to quit. Stopping sync...`);
          userQuit = true;
          break;
        } else if (response === 'yes-all') {
          batchMode = 'yes-all';
          shouldUpload = true;
          console.log(
            `  [BATCH MODE] Enabled: uploading all remaining queries`
          );
        } else if (response === 'skip-all') {
          batchMode = 'skip-all';
          shouldUpload = false;
          console.log(`  [BATCH MODE] Enabled: skipping all remaining queries`);
        } else {
          shouldUpload = response === 'yes';
        }
      }

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
      console.log(
        `  [CONFLICT] Query ${queryId}: ${query.name} (local, cached, and remote all differ)`
      );
      console.log(`    Local hash:  ${localHash || 'null'}`);
      console.log(`    Cached hash: ${cachedHash}`);
      console.log(`    Remote hash: ${remoteHash}`);

      // Determine conflict resolution based on batch mode or prompt
      /** @type {ConflictResponse | null} */
      let resolution = null;

      if (conflictBatchMode === 'local-all') {
        console.log(`  [AUTO] Using local version (batch mode: local-all)`);
        resolution = 'local';
      } else if (conflictBatchMode === 'remote-all') {
        console.log(`  [AUTO] Using remote version (batch mode: remote-all)`);
        resolution = 'remote';
      } else if (!userQuit) {
        const queryUrl = `${client.baseUrl}/queries/${queryId}/source`;
        const response = await promptConflict(`Resolve conflict? ${queryUrl}`);

        if (response === 'local-all') {
          conflictBatchMode = 'local-all';
          resolution = 'local';
          console.log(
            `  [BATCH MODE] Enabled: using local version for all remaining conflicts`
          );
        } else if (response === 'remote-all') {
          conflictBatchMode = 'remote-all';
          resolution = 'remote';
          console.log(
            `  [BATCH MODE] Enabled: using remote version for all remaining conflicts`
          );
        } else {
          resolution = response;
        }
      } else {
        resolution = 'skip';
      }

      if (resolution === 'local' && localSqlContent) {
        // Upload local version to remote
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
            `  [CONFLICT→LOCAL] Query ${queryId}: ${query.name} - local version uploaded to remote`
          );
        } catch (error) {
          console.error(
            `  [ERROR] Failed to upload local version for query ${queryId}: ${error instanceof Error ? error.message : String(error)}`
          );
          conflicts++;
        }
      } else if (resolution === 'remote') {
        // Download remote version
        const metadata = buildMetadata(query, remoteHash);
        await saveQuery(queryId, remoteSqlContent, metadata);
        updatedFromRemote++;
        console.log(
          `  [CONFLICT→REMOTE] Query ${queryId}: ${query.name} - remote version downloaded`
        );
      } else {
        // Skip - keep local version as-is, don't update metadata
        conflicts++;
        console.log(
          `  [CONFLICT→SKIP] Query ${queryId}: ${query.name} - keeping local version, no sync`
        );
      }
      continue;
    }
  }

  const status = userQuit ? 'Sync interrupted' : 'Sync complete';
  console.log(`\n${status}:`);
  console.log(`  New: ${downloaded}`);
  console.log(`  Updated from remote: ${updatedFromRemote}`);
  console.log(`  Updated to remote: ${updatedToRemote}`);
  console.log(`  Skipped (unchanged): ${skipped}`);
  console.log(`  Conflicts: ${conflicts}`);
  console.log(`  Total: ${total}`);
}
