/**
 * Hash utilities for query content tracking
 * Uses native crypto module
 */

import crypto from 'crypto';

/**
 * Generate SHA-256 hash of content
 * Trailing whitespace is trimmed before hashing
 * @param {string} content
 * @returns {string}
 */
export function generateHash(content) {
  const normalized = content.trimEnd();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Generate hash for a query's SQL content
 * @param {{ query?: string }} query
 * @returns {string}
 */
export function hashQuery(query) {
  const content = query.query || '';
  return generateHash(content);
}
