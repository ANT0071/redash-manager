# Redash Manager

Download and manage Redash queries locally with zero external dependencies.

## Features

- Download all queries from your Redash instance
- Save queries as `.sql` files with accompanying metadata
- Track query changes using SHA-256 hashing
- Skip unchanged queries on subsequent downloads
- Zero runtime dependencies (uses Node.js 24 built-in features)
- TypeScript type checking with JSDoc annotations
- Automatic code formatting with Prettier on pre-commit (via lefthook)

## Requirements

- Node.js >= 24.0.0

## Setup

1. Install dependencies (dev only - TypeScript, Prettier, and lefthook):

```bash
npm install
```

This will automatically:

- Install dev dependencies
- Set up `.env` file from `.env-dist` if it doesn't exist
- Install git hooks with lefthook

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

### Code formatting

Format all code:

```bash
npm run format
```

Check formatting without changes:

```bash
npm run format:check
```

### Type checking

Run TypeScript type checks:

```bash
npm run type-check
```

## Project Structure

```
redash-manager/
├── .env-dist              # Environment template
├── .env                   # Your credentials (gitignored)
├── .prettierrc.json       # Prettier configuration
├── .prettierignore        # Prettier ignore patterns
├── lefthook.yml           # Git hooks configuration
├── package.json
├── tsconfig.json          # TypeScript config for type checking
├── src/
│   ├── index.js          # CLI entry point (with JSDoc types)
│   ├── api/
│   │   └── redash.js     # Redash API client (with JSDoc types)
│   ├── services/
│   │   ├── downloader.js # Download logic (with JSDoc types)
│   │   └── hash.js       # Hash generation (with JSDoc types)
│   └── utils/
│       └── fileManager.js # File operations (with JSDoc types)
└── queries/              # Downloaded queries (gitignored)
```

## How it works

1. **Authentication**: Uses `--env-file` flag to load credentials from `.env`
2. **API Client**: Native `fetch` API for HTTP requests
3. **Pagination**: Automatically handles paginated API responses
4. **Change Detection**: SHA-256 hashing to detect modified queries
5. **File Management**: Native `fs/promises` for async file operations
6. **Type Safety**: TypeScript checks JavaScript code via JSDoc annotations

## Development

### Type Safety

The project uses TypeScript for type checking while keeping code in JavaScript with JSDoc annotations. This provides:

- Full type safety without compilation step
- Better IDE autocomplete and error detection
- No build process needed - run directly with Node.js

### Code Quality

- **Prettier**: Enforces consistent code formatting
- **lefthook**: Automatically formats code and runs type checks before commits
- **Pre-commit hooks**:
  - Formats staged files with Prettier
  - Runs TypeScript type checking
  - Runs in parallel for fast execution

### Git Hooks

The pre-commit hook (managed by lefthook) will automatically:

1. Format any staged `.js`, `.json`, `.md`, or `.yml` files
2. Run type checking to catch errors early
3. Add formatted files back to the commit

To skip hooks temporarily (not recommended):

```bash
git commit --no-verify
```

## License

MPL-2.0
