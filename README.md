# Redash Manager

Download and manage Redash queries locally with zero external dependencies.

## Features

- Download all queries from your Redash instance
- Save queries as `.sql` files with accompanying metadata
- Track query changes using SHA-256 hashing
- Skip unchanged queries on subsequent downloads
- Zero external dependencies (uses Node.js 24 built-in features)

## Requirements

- Node.js >= 24.0.0

## Setup

1. Install dependencies (none required, but this will set up your `.env` file):

```bash
npm install
```

2. Configure your Redash credentials in `.env`:

```bash
REDASH_URL=https://your-redash-instance.com
REDASH_API_KEY=your_api_key_here
```

## Usage

### Download all queries

```bash
npm run download
```

This will:
- Connect to your Redash instance
- Fetch all queries
- Save each query to `queries/{id}/query.sql`
- Save metadata to `queries/{id}/query.json`
- Skip queries that haven't changed (based on content hash)

### Query structure

Each query is saved in its own directory:

```
queries/
├── 123/
│   ├── query.sql      # SQL query content
│   └── query.json     # Metadata and hash
├── 456/
│   ├── query.sql
│   └── query.json
...
```

### Metadata format

The `query.json` file contains:

```json
{
  "id": 123,
  "name": "Query Name",
  "description": "Query description",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-02T00:00:00Z",
  "data_source_id": 1,
  "user_id": 5,
  "is_archived": false,
  "is_draft": false,
  "tags": ["tag1", "tag2"],
  "hash": "abc123...",
  "downloaded_at": "2024-01-03T00:00:00Z"
}
```

## Project Structure

```
redash-manager/
├── .env-dist              # Environment template
├── .env                   # Your credentials (gitignored)
├── package.json
├── src/
│   ├── index.js          # CLI entry point
│   ├── api/
│   │   └── redash.js     # Redash API client
│   ├── services/
│   │   ├── downloader.js # Download logic
│   │   └── hash.js       # Hash generation
│   └── utils/
│       └── fileManager.js # File operations
└── queries/              # Downloaded queries (gitignored)
```

## How it works

1. **Authentication**: Uses `--env-file` flag to load credentials from `.env`
2. **API Client**: Native `fetch` API for HTTP requests
3. **Pagination**: Automatically handles paginated API responses
4. **Change Detection**: SHA-256 hashing to detect modified queries
5. **File Management**: Native `fs/promises` for async file operations

## License

MPL-2.0
