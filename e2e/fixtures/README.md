# E2E Test Fixtures

This directory contains JSON fixtures for stubbing external API calls in e2e tests.

## Directory Structure

```
e2e/fixtures/
├── github/           # GitHub API response fixtures
│   ├── issues-basic.json
│   ├── issues-multiple.json
│   ├── persistence-test.json
│   ├── repositories-basic.json
│   └── repositories-multiple.json
└── README.md
```

## Usage

### Basic API Stubbing

Use the `stubAPI` helper to stub a single API call:

```typescript
import { stubAPI } from "../helpers/api-stubbing";

// Stub GitHub issues API with basic fixture
await stubAPI(page, "github", "fetchIssues", "issues-basic");
```

### Multiple API Stubbing

Use `stubMultipleAPIs` to stub multiple API calls at once:

```typescript
import { stubMultipleAPIs } from "../helpers/api-stubbing";

await stubMultipleAPIs(page, {
  github: {
    fetchIssues: "issues-multiple",
    fetchRepositories: "repositories-basic"
  }
});
```

### GitHub-Specific Helper

Use the GitHub-specific helper for convenience:

```typescript
import { stubGitHubWithFixtures } from "../helpers/github-integration-helpers";

await stubGitHubWithFixtures(page, {
  issues: "issues-basic",
  repositories: "repositories-basic"
});
```

### Restoring APIs

Always restore APIs after stubbing:

```typescript
import { restoreAPI } from "../helpers/api-stubbing";

await restoreAPI(page, "github");
```

## Available Fixtures

### GitHub Issues

- **`issues-basic.json`** - Single test issue for basic functionality
- **`issues-multiple.json`** - Multiple issues with different labels and assignees
- **`persistence-test.json`** - Specific issue for testing import persistence

### GitHub Repositories

- **`repositories-basic.json`** - Single repository (obsidian-task-sync)
- **`repositories-multiple.json`** - Multiple repositories with different properties

## Creating New Fixtures

1. Create a new JSON file in the appropriate service directory (e.g., `e2e/fixtures/github/`)
2. Use realistic API response structure
3. Include all required fields for the API
4. Use descriptive names that indicate the fixture's purpose

### Example Fixture Structure

```json
[
  {
    "id": 123456,
    "number": 42,
    "title": "Example Issue",
    "body": "This is an example issue for testing.",
    "labels": [
      {
        "id": 1,
        "name": "bug",
        "color": "d73a4a",
        "description": "Something isn't working"
      }
    ],
    "assignee": null,
    "assignees": [],
    "state": "open",
    "html_url": "https://github.com/owner/repo/issues/42",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "closed_at": null,
    "user": {
      "login": "testuser",
      "id": 5678,
      "avatar_url": "https://avatars.githubusercontent.com/u/5678?v=4",
      "html_url": "https://github.com/testuser"
    }
  }
]
```

## Benefits

1. **Maintainable** - Fixtures are separate from test code
2. **Reusable** - Same fixtures can be used across multiple tests
3. **Realistic** - Fixtures contain realistic API response data
4. **Debuggable** - Easy to inspect and modify fixture data
5. **Fast** - No network calls during tests
6. **Reliable** - Tests don't depend on external API availability

## Migration from Old Stubbing

The old `stubGitHubApiResponses` function is deprecated. Migrate to the new system:

```typescript
// OLD (deprecated)
await stubGitHubApiResponses(page, {
  issues: [{ id: 1, title: "Test" }],
  repositories: [{ id: 1, name: "test-repo" }]
});

// NEW (recommended)
await stubGitHubWithFixtures(page, {
  issues: "issues-basic",
  repositories: "repositories-basic"
});
```
