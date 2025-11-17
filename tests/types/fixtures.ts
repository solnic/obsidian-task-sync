/**
 * Test type definitions for fixture data structures
 * Defines schemas and types for test fixtures loaded from JSON files
 */

import type { Task, Project, Area } from "../../src/app/core/entities";

/**
 * Task fixture data structure
 * Mirrors the Task entity but allows for partial data in test fixtures
 */
export interface TaskFixture extends Partial<Task> {
  id: string;
  title: string;
}

/**
 * Project fixture data structure
 * Mirrors the Project entity but allows for partial data in test fixtures
 */
export interface ProjectFixture extends Partial<Project> {
  id: string;
  name: string;
}

/**
 * Area fixture data structure
 * Mirrors the Area entity but allows for partial data in test fixtures
 */
export interface AreaFixture extends Partial<Area> {
  id: string;
  name: string;
}

/**
 * Generic API response fixture for stubbing external APIs
 */
export interface ApiResponseFixture<T = unknown> {
  data: T;
  status: number;
  headers?: Record<string, string>;
}

/**
 * GitHub API fixture data structures
 */
export interface GitHubIssueFixture {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  body?: string;
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string }>;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepoFixture {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  private: boolean;
}

/**
 * Apple Reminders fixture data structures
 */
export interface AppleReminderFixture {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  dueDate?: string;
  list: string;
}

/**
 * Calendar event fixture data structures
 */
export interface CalendarEventFixture {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  description?: string;
  location?: string;
}
