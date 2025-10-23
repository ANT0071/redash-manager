#!/usr/bin/env node

/**
 * Redash Manager CLI
 * Main entry point for the application
 */

import { downloadQueries } from './services/downloader.js';

/**
 * @typedef {Object} Command
 * @property {string} description
 * @property {() => Promise<void>} action
 */

/** @type {Record<string, Command>} */
const COMMANDS = {
  download: {
    description: 'Download all queries from Redash',
    action: downloadQueries,
  },
};

/**
 * Display help information
 * @returns {void}
 */
function showHelp() {
  console.log('Redash Manager - Download and manage Redash queries locally\n');
  console.log('Usage: npm run <command>\n');
  console.log('Available commands:');

  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(15)} ${cmd.description}`);
  }

  console.log('\nEnvironment variables (configured in .env):');
  console.log('  REDASH_URL      Base URL of your Redash instance');
  console.log('  REDASH_API_KEY  Your Redash API key');
}

/**
 * Main function
 * @returns {Promise<void>}
 */
async function main() {
  const command = process.argv[2];

  if (!command || command === 'help' || command === '--help') {
    showHelp();
    process.exit(0);
  }

  const cmd = COMMANDS[command];

  if (!cmd) {
    console.error(`Error: Unknown command '${command}'`);
    console.error('Run with no arguments to see available commands.\n');
    process.exit(1);
  }

  try {
    await cmd.action();
  } catch (error) {
    console.error(
      '\nError:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
