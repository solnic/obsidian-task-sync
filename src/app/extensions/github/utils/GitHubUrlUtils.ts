/**
 * Utility functions for working with GitHub URLs
 */

/**
 * Extract repository name from GitHub URL
 * @param url GitHub URL (e.g., "https://github.com/owner/repo/issues/123")
 * @returns Repository name in format "owner/repo" or null if not a valid GitHub URL
 */
export function extractRepositoryFromGitHubUrl(url: string): string | null {
  if (!url) return null;

  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)(?:\/|$)/);
  return match ? match[1] : null;
}

/**
 * Check if a GitHub URL matches a specific repository
 * @param url GitHub URL
 * @param repository Repository name in format "owner/repo"
 * @returns True if the URL belongs to the specified repository
 */
export function isGitHubUrlForRepository(
  url: string,
  repository: string
): boolean {
  const extractedRepo = extractRepositoryFromGitHubUrl(url);
  return extractedRepo === repository;
}
