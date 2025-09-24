import { z } from "zod";

// Raw GitHub API response schemas
export const GitHubIssueSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  assignee: z
    .object({
      login: z.string(),
    })
    .nullable(),
  labels: z.array(
    z.object({
      name: z.string(),
      color: z.string().optional(),
    })
  ),
  created_at: z.string(),
  updated_at: z.string(),
  html_url: z.string().url(),
});

export const GitHubIssueListSchema = z.array(GitHubIssueSchema);

export const GitHubPullRequestSchema = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  assignee: z
    .object({
      login: z.string(),
    })
    .nullable(),
  assignees: z.array(
    z.object({
      login: z.string(),
    })
  ),
  labels: z.array(
    z.object({
      name: z.string(),
      color: z.string().optional(),
    })
  ),
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
    user: z.object({
      login: z.string(),
    }),
  }),
  base: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: z.object({
      login: z.string(),
    }),
  }),
  user: z.object({
    login: z.string(),
  }),
  requested_reviewers: z.array(
    z.object({
      login: z.string(),
    })
  ),
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
