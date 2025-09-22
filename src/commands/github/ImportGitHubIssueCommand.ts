/**
 * Import GitHub Issue Command
 * Imports a single GitHub issue as a task
 */

import { Command, type CommandContext } from "../Command";
import { Notice, Modal, App } from "obsidian";

export class ImportGitHubIssueCommand extends Command {
  constructor(context: CommandContext) {
    super(context);
  }

  getId(): string {
    return "import-github-issue";
  }

  getName(): string {
    return "Import GitHub Issue";
  }

  isAvailable(): boolean {
    return this.settings.integrations.github.enabled;
  }

  async execute(): Promise<void> {
    const githubService = this.integrationManager.getGitHubService();
    if (!githubService?.isEnabled()) {
      new Notice("GitHub integration is not enabled or configured");
      return;
    }

    try {
      // For now, show a simple prompt for issue URL
      // In a full implementation, this could be a modal with repository selection
      const issueUrl = await this.promptForIssueUrl();
      if (!issueUrl) {
        return;
      }

      const issueData = await this.fetchIssueFromUrl(issueUrl);
      if (!issueData) {
        new Notice("Failed to fetch GitHub issue");
        return;
      }

      // Use default import configuration
      const config = (this.plugin as any).getDefaultImportConfig();

      const result = await githubService.importIssueAsTask(
        issueData.issue,
        config,
        issueData.repository
      );

      if (result.success) {
        if (result.skipped) {
          new Notice(`Issue already imported: ${result.reason}`);
        } else {
          new Notice(`Successfully imported issue: ${issueData.issue.title}`);
        }
      } else {
        new Notice(`Failed to import issue: ${result.error}`);
      }
    } catch (error: any) {
      console.error("Failed to import GitHub issue:", error);
      new Notice(`Error importing issue: ${error.message}`);
    }
  }

  /**
   * Prompt user for GitHub issue URL
   */
  private async promptForIssueUrl(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new (class extends Modal {
        result: string | null = null;

        constructor(app: App) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.createEl("h2", { text: "Import GitHub Issue" });

          const inputEl = contentEl.createEl("input", {
            type: "text",
            placeholder: "https://github.com/owner/repo/issues/123",
          });
          inputEl.style.width = "100%";
          inputEl.style.marginBottom = "10px";

          const buttonContainer = contentEl.createDiv();
          buttonContainer.style.textAlign = "right";

          const cancelBtn = buttonContainer.createEl("button", {
            text: "Cancel",
          });
          cancelBtn.style.marginRight = "10px";
          cancelBtn.onclick = () => {
            this.result = null;
            this.close();
          };

          const importBtn = buttonContainer.createEl("button", {
            text: "Import",
          });
          importBtn.onclick = () => {
            this.result = inputEl.value.trim();
            this.close();
          };

          inputEl.focus();
          inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              this.result = inputEl.value.trim();
              this.close();
            }
          });
        }

        onClose() {
          resolve(this.result);
        }
      })(this.plugin.app);

      modal.open();
    });
  }

  /**
   * Fetch GitHub issue from URL
   */
  private async fetchIssueFromUrl(
    url: string
  ): Promise<{ issue: any; repository: string } | null> {
    try {
      const githubService = this.integrationManager.getGitHubService();
      if (!githubService) {
        new Notice("GitHub integration is not available");
        return null;
      }

      // Parse GitHub URL to extract owner, repo, and issue number
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/);
      if (!match) {
        new Notice("Invalid GitHub issue URL format");
        return null;
      }

      const [, owner, repo, issueNumber] = match;
      const repository = `${owner}/${repo}`;

      // Fetch all issues from the repository and find the specific one
      const issues = await githubService.fetchIssues(repository);
      const issue = issues.find(
        (issue: any) => issue.number === parseInt(issueNumber)
      );

      if (!issue) {
        new Notice("Issue not found or access denied");
        return null;
      }

      return { issue, repository };
    } catch (error: any) {
      console.error("Error fetching GitHub issue:", error);
      new Notice(`Error fetching issue: ${error.message}`);
      return null;
    }
  }
}
