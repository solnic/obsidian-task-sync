/**
 * Tests for GitHub API Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Octokit
const mockListForRepo = vi.fn();
const mockListForAuthenticatedUser = vi.fn();

vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(() => ({
      rest: {
        issues: {
          listForRepo: mockListForRepo
        },
        repos: {
          listForAuthenticatedUser: mockListForAuthenticatedUser
        }
      }
    }))
  };
});

describe('GitHubService', () => {
  let githubService: any;
  const mockSettings = {
    githubIntegration: {
      enabled: true,
      personalAccessToken: 'ghp_test1234567890abcdef1234567890abcdef1234',
      repositories: ['owner/repo1', 'owner/repo2'],
      defaultRepository: 'owner/repo1',
      issueFilters: {
        state: 'open' as const,
        assignee: 'me',
        labels: [] as any[]
      }
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockListForRepo.mockClear();
    mockListForAuthenticatedUser.mockClear();

    // Import the service fresh for each test
    const { GitHubService } = await import('../../../src/services/GitHubService');
    githubService = new GitHubService(mockSettings);
  });

  it('should create GitHubService instance with settings', () => {
    expect(githubService).toBeDefined();
    expect(githubService.isEnabled()).toBe(true);
  });

  it('should be disabled when integration is disabled in settings', async () => {
    const disabledSettings = {
      ...mockSettings,
      githubIntegration: {
        ...mockSettings.githubIntegration,
        enabled: false
      }
    };

    const { GitHubService } = await import('../../../src/services/GitHubService');
    const disabledService = new GitHubService(disabledSettings);

    expect(disabledService.isEnabled()).toBe(false);
  });

  it('should fetch issues from GitHub API', async () => {
    const mockIssues = [
      {
        id: 1,
        number: 123,
        title: 'Test Issue',
        body: 'Test description',
        state: 'open',
        assignee: { login: 'testuser' },
        labels: [{ name: 'bug' }],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        html_url: 'https://github.com/owner/repo1/issues/123'
      }
    ];

    // Mock the Octokit response
    mockListForRepo.mockResolvedValue({
      data: mockIssues
    });

    const issues = await githubService.fetchIssues('owner/repo1');

    expect(issues).toEqual(mockIssues);
  });

  it('should handle API errors gracefully', async () => {
    mockListForRepo.mockRejectedValue(
      new Error('Request failed with status code 401')
    );

    await expect(githubService.fetchIssues('owner/repo1')).rejects.toThrow();
  });

  it('should fetch repositories for authenticated user', async () => {
    const mockRepos = [
      {
        id: 1,
        name: 'repo1',
        full_name: 'owner/repo1',
        description: 'Test repository',
        private: false
      }
    ];

    mockListForAuthenticatedUser.mockResolvedValue({
      data: mockRepos
    });

    const repos = await githubService.fetchRepositories();

    expect(repos).toEqual(mockRepos);
  });

  it('should validate repository format', () => {
    expect(githubService.validateRepository('owner/repo')).toBe(true);
    expect(githubService.validateRepository('invalid')).toBe(false);
    expect(githubService.validateRepository('')).toBe(false);
    expect(githubService.validateRepository('owner/repo/extra')).toBe(false);
  });

  it('should handle rate limiting', async () => {
    const { Octokit } = await import('@octokit/rest');
    const mockOctokit = new Octokit();

    const rateLimitError = new Error('API rate limit exceeded');
    (rateLimitError as any).status = 403;
    (mockOctokit.rest.issues.listForRepo as any).mockRejectedValue(rateLimitError);

    await expect(githubService.fetchIssues('owner/repo1')).rejects.toThrow();
  });
});
