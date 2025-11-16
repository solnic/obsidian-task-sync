import { z } from "zod";

// Shared GitHub User schema for nested user objects
export const GitHubUserSchema = z.object({
  login: z.string(),
});

// Shared GitHub Label schema for nested label objects (basic version)
export const GitHubLabelBasicSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
});

// Raw GitHub API response schemas
export const GitHubIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  assignee: GitHubUserSchema.nullable(),
  labels: z.array(GitHubLabelBasicSchema),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string().url(),
  // GitHub API includes this field when the "issue" is actually a pull request
  pull_request: z
    .object({
      url: z.string().url(),
      html_url: z.string().url(),
      diff_url: z.string().url(),
      patch_url: z.string().url(),
    })
    .optional(),
});

export const GitHubIssueListSchema = z.array(GitHubIssueSchema);

export const GitHubPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  assignee: GitHubUserSchema.nullable(),
  assignees: z.array(GitHubUserSchema),
  labels: z.array(GitHubLabelBasicSchema),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  html_url: z.string().url(),
  diff_url: z.string(),
  patch_url: z.string(),
  head: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: GitHubUserSchema,
  }),
  base: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: GitHubUserSchema,
  }),
  user: GitHubUserSchema,
  requested_reviewers: z.array(GitHubUserSchema),
  draft: z.boolean(),
});

export const GitHubPullRequestListSchema = z.array(GitHubPullRequestSchema);

export const GitHubLabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
  default: z.boolean().optional(),
  url: z.string().url().optional(),
});

export const GitHubLabelListSchema = z.array(GitHubLabelSchema);

export const GitHubRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  html_url: z.string().url(),
  clone_url: z.string().url(),
  ssh_url: z.string(),
  default_branch: z.string(),
  language: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string().nullable(),
});

export const GitHubRepositoryListSchema = z.array(GitHubRepositorySchema);

export const GitHubOrganizationSchema = z.object({
  id: z.number(),
  login: z.string(),
  description: z.string().nullable(),
  avatar_url: z.string().url(),
});

export const GitHubOrganizationListSchema = z.array(GitHubOrganizationSchema);

export type GitHubIssue = z.infer<typeof GitHubIssueSchema>;
export type GitHubIssueList = z.infer<typeof GitHubIssueListSchema>;
export type GitHubPullRequest = z.infer<typeof GitHubPullRequestSchema>;
export type GitHubPullRequestList = z.infer<typeof GitHubPullRequestListSchema>;
export type GitHubLabel = z.infer<typeof GitHubLabelSchema>;
export type GitHubLabelList = z.infer<typeof GitHubLabelListSchema>;
export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;
export type GitHubRepositoryList = z.infer<typeof GitHubRepositoryListSchema>;
export type GitHubOrganization = z.infer<typeof GitHubOrganizationSchema>;
export type GitHubOrganizationList = z.infer<
  typeof GitHubOrganizationListSchema
>;
