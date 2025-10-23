/**
 * @typedef {Object} QueryMetadata
 * @property {number} id
 * @property {string} name
 * @property {string} description
 * @property {string} created_at
 * @property {string} updated_at
 * @property {number} data_source_id
 * @property {number} user_id
 * @property {boolean} is_archived
 * @property {boolean} is_draft
 * @property {string[]} tags
 * @property {string} hash
 * @property {string} downloaded_at
 */

/**
 * File management utilities
 * Uses native fs/promises module
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Project root is two levels up from src/utils
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const QUERIES_DIR = path.join(PROJECT_ROOT, 'queries');

/**
 * Ensure the queries directory exists
 * @returns {Promise<void>}
 */
export async function ensureQueriesDir() {
  await fs.mkdir(QUERIES_DIR, { recursive: true });
}

/**
 * Get the directory path for a specific query
 * @param {number} queryId
 * @returns {string}
 */
export function getQueryDir(queryId) {
  return path.join(QUERIES_DIR, String(queryId));
}

/**
 * Get the file path for a query's SQL file
 * @param {number} queryId
 * @returns {string}
 */
export function getQuerySqlPath(queryId) {
  return path.join(getQueryDir(queryId), 'query.sql');
}

/**
 * Get the file path for a query's metadata JSON file
 * @param {number} queryId
 * @returns {string}
 */
export function getQueryJsonPath(queryId) {
  return path.join(getQueryDir(queryId), 'query.json');
}

/**
 * Save a query to the filesystem
 * @param {number} queryId
 * @param {string} sqlContent
 * @param {QueryMetadata} metadata
 * @returns {Promise<void>}
 */
export async function saveQuery(queryId, sqlContent, metadata) {
  const queryDir = getQueryDir(queryId);

  // Create directory for this query
  await fs.mkdir(queryDir, { recursive: true });

  // Save SQL file
  const sqlPath = getQuerySqlPath(queryId);
  await fs.writeFile(sqlPath, sqlContent, 'utf8');

  // Save metadata JSON
  const jsonPath = getQueryJsonPath(queryId);
  await fs.writeFile(jsonPath, JSON.stringify(metadata, null, 2), 'utf8');
}

/**
 * Check if a query already exists locally
 * @param {number} queryId
 * @returns {Promise<boolean>}
 */
export async function queryExists(queryId) {
  try {
    const sqlPath = getQuerySqlPath(queryId);
    await fs.access(sqlPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read existing query metadata
 * @param {number} queryId
 * @returns {Promise<QueryMetadata | null>}
 */
export async function readQueryMetadata(queryId) {
  try {
    const jsonPath = getQueryJsonPath(queryId);
    const content = await fs.readFile(jsonPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read query SQL content from file
 * @param {number} queryId
 * @returns {Promise<string | null>}
 */
export async function readQuerySql(queryId) {
  try {
    const sqlPath = getQuerySqlPath(queryId);
    return await fs.readFile(sqlPath, 'utf8');
  } catch {
    return null;
  }
}
