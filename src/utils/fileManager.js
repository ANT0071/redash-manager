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
 */
export async function ensureQueriesDir() {
  await fs.mkdir(QUERIES_DIR, { recursive: true });
}

/**
 * Get the directory path for a specific query
 */
export function getQueryDir(queryId) {
  return path.join(QUERIES_DIR, String(queryId));
}

/**
 * Get the file path for a query's SQL file
 */
export function getQuerySqlPath(queryId) {
  return path.join(getQueryDir(queryId), 'query.sql');
}

/**
 * Get the file path for a query's metadata JSON file
 */
export function getQueryJsonPath(queryId) {
  return path.join(getQueryDir(queryId), 'query.json');
}

/**
 * Save a query to the filesystem
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
