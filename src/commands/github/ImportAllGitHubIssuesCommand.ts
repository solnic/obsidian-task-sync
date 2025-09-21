/**
 * Import All GitHub Issues Command
 * Imports all GitHub issues from the default repository
 */

import { Command, type CommandContext } from "../Command";
import { Notice } from "obsidian";

export class ImportAllGitHubIssuesCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "import-all-github-issues";
  }

  getName(): string {
    return "Import All GitHub Issues";
  }

  isAvailable(): boolean {
    return this.settings.githubIntegration.enabled;
  }

  async execute(): Promise<void> {
    const githubService = this.integrationManager.getGitHubService();
    if (!githubService?.isEnabled()) {
      new Notice("GitHub integration is not enabled or configured");
      return;
    }

    try {
      const repository = this.settings.githubIntegration.defaultRepository;
      if (!repository) {
        new Notice("No default repository configured");
        return;
      }

      new Notice("Fetching GitHub issues...");

      const issues = await githubService.fetchIssues(repository);
      if (issues.length === 0) {
        new Notice("No issues found in repository");
        return;
      }

      new Notice(`Found ${issues.length} issues. Starting import...`);

      const config = (this.plugin as any).getDefaultImportConfig();
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const issue of issues) {
        try {
          const result = await githubService.importIssueAsTask(
            issue,
            config,
            repository
          );

          if (result.success) {
            if (result.skipped) {
              skipped++;
            } else {
              imported++;
            }
          } else {
            failed++;
            console.error(
              `Failed to import issue ${issue.number}:`,
              result.error
            );
          }
        } catch (error: any) {
          failed++;
          console.error(`Error importing issue ${issue.number}:`, error);
        }
      }

      new Notice(
        `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`
      );
    } catch (error: any) {
      console.error("Failed to import GitHub issues:", error);
      new Notice(`Error importing issues: ${error.message}`);
    }
  }
}
