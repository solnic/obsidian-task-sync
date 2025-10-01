
Phase 1: Core GitHub Extension Infrastructure
1.1 Create GitHubExtension Class
File: src/app/extensions/GitHubExtension.ts

Purpose: Main extension class implementing the Extension interface

Key Components:

Implements Extension interface (similar to ObsidianExtension)
Extension ID: "github"
Supported entities: ["task"] (GitHub only provides tasks, not areas/projects)
Manages GitHub API client (Octokit) lifecycle
Provides observable task store for GitHub-imported tasks
Implements search/filter/sort methods required by ExtensionDataAccess
Dependencies:

Copy GitHub API client code from old-stuff/services/GitHubService.ts (lines 298-373 for Octokit setup)
Use existing taskStore for storing imported tasks
Integrate with eventBus for extension lifecycle events
Natural Key Strategy:

For GitHub tasks: github-issue-{issueId} or github-pr-{prId}
Store in source.externalId field
Use for upsert logic to prevent duplicate imports
1.2 Create GitHub Task Operations
File: src/app/extensions/GitHubTaskOperations.ts

Purpose: Handle GitHub-specific task operations (import, transform)

Key Methods:

Source Code to Copy:

Copy transformation logic from old-stuff/services/sources/GitHubTaskSource.ts
Copy import logic from old-stuff/services/GitHubService.ts (importIssueAsTask method)
Preserve label-to-category mapping logic
Preserve org/repo to area/project mapping logic
1.3 Port Caching System
Files to Copy AS-IS:

old-stuff/cache/CacheManager.ts → src/app/cache/CacheManager.ts
old-stuff/cache/SchemaCache.ts → src/app/cache/SchemaCache.ts
old-stuff/cache/schemas/github.ts → src/app/cache/schemas/github.ts
Integration:

GitHubExtension will use SchemaCache for issues, PRs, repositories, organizations, labels
Cache keys follow same pattern as old implementation
Preload caches during extension initialization
NO MODIFICATIONS - Copy these files exactly as they are. They're proven to work.

1.4 Port GitHub API Client
Source: old-stuff/services/GitHubService.ts

Code to Copy Directly:

Octokit initialization with Obsidian's requestUrl adapter (lines 302-373)
All API methods: fetchIssues, fetchRepositories, fetchPullRequests, fetchOrganizations, fetchLabels, getCurrentUser
Cache integration logic
Token validation and management
Integration Point:

GitHubExtension will own the Octokit instance
API methods will be private methods on GitHubExtension class
Phase 2: UI Components
2.1 Create GitHubService.svelte Component
File: src/app/components/GitHubService.svelte

Source: old-stuff/components/svelte/GitHubService.svelte

CRITICAL REQUIREMENTS:

COPY markup structure EXACTLY - preserve all CSS classes and DOM structure
DO NOT modify styles - existing CSS in src/styles/ must work without changes
DO NOT add new CSS classes - use existing classes only
Component Structure:

Key Differences from Old Implementation:

Use extension prop instead of githubService prop
Call extension.refresh() instead of githubService.clearCache()
Access GitHub API methods via extension instance
Use host.saveData() for persisting filter state
2.2 Create Supporting Components
Files to Copy:

old-stuff/components/svelte/GitHubIssueItem.svelte → src/app/components/GitHubIssueItem.svelte
old-stuff/components/svelte/GitHubPullRequestItem.svelte → src/app/components/GitHubPullRequestItem.svelte
Requirements:

Copy markup EXACTLY - preserve all CSS classes
Update import paths to new architecture
Use extension methods for import actions
2.3 Update Service.svelte Router
File: src/app/components/Service.svelte

Changes:

Phase 3: Settings Integration
3.1 Update TaskSyncSettings Type
File: src/app/types/settings.ts

Add:

3.2 Update Settings UI
File: src/app/components/settings/SettingsTab.ts

Add GitHub Integration Section:

Copy GitHub settings UI from old-stuff/components/ui/settings/
Token input field
Default repository input
Label mapping configuration
Org/repo mapping configuration
Phase 4: Extension Registration & Lifecycle
4.1 Update App.ts
File: src/app/App.ts

Changes:

4.2 Update ObsidianHost
File: src/app/hosts/ObsidianHost.ts

Update getExtensionById:

No changes needed - already supports dynamic extension lookup.

Phase 5: Testing Migration
5.1 Port Test Specs to Playwright
Source Files (vitest):

tests/e2e/specs-old/vitest/github-integration.e2e.ts
tests/e2e/specs-old/vitest/github-import-persistence.e2e.ts
tests/e2e/specs-old/vitest/github-mapping-precedence.e2e.ts
tests/e2e/specs-old/vitest/context-aware-github-import.e2e.ts
tests/e2e/specs-old/vitest/github-pull-requests.e2e.ts
Target Files (Playwright):

tests/e2e/specs/github-integration.spec.ts
tests/e2e/specs/github-import-persistence.spec.ts
tests/e2e/specs/github-mapping-precedence.spec.ts
tests/e2e/specs/context-aware-github-import.spec.ts
tests/e2e/specs/github-pull-requests.spec.ts
Migration Strategy:

IMPROVEMENTS:

Replace fixed timeouts with smart waiting:
Use Playwright's auto-waiting:
Leverage test helpers from global.ts:
Use existing helpers like enableIntegration, openView, switchToTaskService
These are auto-imported via Playwright config
5.2 Keep Existing Fixtures
No Changes Needed:

All fixtures in tests/e2e/fixtures/github/ work as-is
Stubbing system in tests/e2e/helpers/api-stubbing.ts already supports GitHub
Helper functions in tests/e2e/helpers/github-integration-helpers.ts can be reused
5.3 Update Test Helpers (if needed)
File: tests/e2e/helpers/github-integration-helpers.ts

Potential Updates:

Update helper functions to work with new GitHubExtension API
Ensure stubbing works with new extension architecture
Add any new helpers needed for improved test patterns
Phase 6: Supporting Utilities
6.1 Port Label Mapping
Files to Copy:

old-stuff/services/GitHubLabelTypeMapper.ts → src/app/utils/GitHubLabelTypeMapper.ts
old-stuff/types/label-mapping.ts → src/app/types/label-mapping.ts
6.2 Port Org/Repo Mapping
Files to Copy:

old-stuff/services/GitHubOrgRepoMapper.ts → src/app/utils/GitHubOrgRepoMapper.ts
6.3 Port Task Import Manager
File: old-stuff/services/TaskImportManager.ts

Decision: Evaluate if this is still needed or if logic can be integrated into GitHubTaskOperations

Phase 7: Data Migration & Persistence
7.1 Import Status Tracking
Strategy:

Store imported issue/PR IDs in Host data storage
Use source.externalId field to track GitHub issue/PR ID
Check taskStore for existing tasks with matching externalId before import
Implementation:

7.2 Filter State Persistence
Strategy:

Store GitHub service settings (filters, sort, recently used) in Host data
Load on extension initialization
Save on component destroy
Implementation:

Phase 8: Verification & Testing
8.1 Manual Testing Checklist
GitHub integration can be enabled/disabled in settings
Token validation works correctly
Repository selection works (with org filtering)
Issues load and display correctly
Pull requests load and display correctly
Import button appears for non-imported issues
Import creates task file in Obsidian vault
Imported task appears in Local Tasks view
Import status persists across plugin reload
Label mapping works (labels → category)
Org/repo mapping works (repo → area/project)
Search/filter/sort work correctly
Recently used filters persist
UI matches old implementation exactly
8.2 Automated Test Verification
All Playwright tests pass
No fixed timeouts in tests
Debug artifacts work for failing tests
Test coverage matches old implementation
New tests use improved patterns (smart waiting, better helpers)
8.3 CSS Verification
No new CSS files created
No modifications to existing CSS files
All UI elements styled correctly with existing classes
No inline styles in components
Implementation Order
Sprint 1: Core Infrastructure (Days 1-3)
Create GitHubExtension class skeleton
Port caching system (copy AS-IS)
Port GitHub API client code
Create GitHubTaskOperations class
Register extension in App.ts
Sprint 2: UI Components (Days 4-6)
Port GitHubService.svelte (copy markup exactly)
Port GitHubIssueItem and GitHubPullRequestItem components
Update Service.svelte router
Verify UI matches old implementation
Sprint 3: Settings & Integration (Days 7-8)
Update settings types
Port settings UI
Implement filter state persistence
Test integration end-to-end
Sprint 4: Testing (Days 9-11)
Port first test spec to Playwright
Improve test with smart waiting patterns
Port remaining test specs
Verify all tests pass
Verify debug artifacts work
Sprint 5: Polish & Verification (Day 12)
Manual testing against checklist
CSS verification
Performance testing
Documentation updates
Risk Mitigation
Risk 1: UI Doesn't Match Old Implementation
Mitigation: Copy markup structure EXACTLY, test side-by-side comparison

Risk 2: Caching System Breaks
Mitigation: Copy cache files AS-IS without modifications, test thoroughly

Risk 3: Tests Are Flaky
Mitigation: Use Playwright's auto-waiting, eliminate all fixed timeouts, use smart waiting patterns

Risk 4: Import Logic Breaks
Mitigation: Copy transformation logic exactly from GitHubTaskSource, add comprehensive tests

Success Criteria
✅ Functional:

GitHub integration works identically to old implementation
All import scenarios work (issues, PRs, with mappings, with context)
Import status persists correctly
Caching works as before
✅ Architectural:

Follows ObsidianExtension pattern exactly
Implements Extension interface correctly
Uses taskStore for state management
Integrates with Host abstraction
✅ UI:

Looks identical to old implementation
Uses existing CSS without modifications
No new styles added
All interactions work smoothly
✅ Testing:

All Playwright tests pass
No fixed timeouts
Debug artifacts work
Test coverage maintained or improved
