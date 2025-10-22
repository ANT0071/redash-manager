/**
 * Hash utilities for query content tracking
 * Uses native crypto module
 */

import crypto from 'crypto';

/**
 * Generate SHA-256 hash of content
 */
export function generateHash(content) {
  return crypto
    .createHash('sha256')
    .update(content, 'utf8')
    .digest('hex');
}

/**
 * Generate hash for a query's SQL content
 */
export function hashQuery(query) {
  const content = query.query || '';
  return generateHash(content);
}
