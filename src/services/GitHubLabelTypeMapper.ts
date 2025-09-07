/**
 * GitHub-specific implementation of label-to-type mapping
 * Maps GitHub issue labels to Obsidian task types based on configuration
 */

import { LabelTypeMapper, LabelMappingConfig } from '../types/label-mapping';

export class GitHubLabelTypeMapper implements LabelTypeMapper {
  private labelMapping: Record<string, string> = {};
  private config: LabelMappingConfig;

  constructor(config?: Partial<LabelMappingConfig>) {
    this.config = {
      labelToTypeMapping: {},
      defaultTaskType: 'Task',
      mappingStrategy: 'first-match',
      ...config
    };
    
    this.labelMapping = this.config.labelToTypeMapping;
  }

  /**
   * Map GitHub labels to a task type
   * Uses configured mapping and strategy to determine the best type
   */
  mapLabelsToType(labels: string[], availableTypes: string[]): string | undefined {
    if (!labels || labels.length === 0) {
      return undefined;
    }

    // Normalize labels to lowercase for case-insensitive matching
    const normalizedLabels = labels.map(label => label.toLowerCase());
    
    if (this.config.mappingStrategy === 'priority-based' && this.config.labelPriority) {
      return this.mapWithPriority(normalizedLabels, availableTypes);
    } else {
      return this.mapFirstMatch(normalizedLabels, availableTypes);
    }
  }

  /**
   * Set the label-to-type mapping configuration
   */
  setLabelMapping(mapping: Record<string, string>): void {
    this.labelMapping = { ...mapping };
    this.config.labelToTypeMapping = this.labelMapping;
  }

  /**
   * Get the current label-to-type mapping configuration
   */
  getLabelMapping(): Record<string, string> {
    return { ...this.labelMapping };
  }

  /**
   * Check if a label has a configured mapping
   */
  hasMapping(label: string): boolean {
    return label.toLowerCase() in this.labelMapping;
  }

  /**
   * Update the mapping configuration
   */
  updateConfig(config: Partial<LabelMappingConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.labelToTypeMapping) {
      this.labelMapping = config.labelToTypeMapping;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): LabelMappingConfig {
    return { ...this.config };
  }

  /**
   * Map labels using first-match strategy
   * Returns the first label that has a mapping to an available type
   */
  private mapFirstMatch(normalizedLabels: string[], availableTypes: string[]): string | undefined {
    for (const label of normalizedLabels) {
      const mappedType = this.labelMapping[label];
      if (mappedType && availableTypes.includes(mappedType)) {
        return mappedType;
      }
    }
    return undefined;
  }

  /**
   * Map labels using priority-based strategy
   * Returns the highest priority label that has a mapping
   */
  private mapWithPriority(normalizedLabels: string[], availableTypes: string[]): string | undefined {
    if (!this.config.labelPriority) {
      return this.mapFirstMatch(normalizedLabels, availableTypes);
    }

    // Check labels in priority order
    for (const priorityLabel of this.config.labelPriority) {
      const normalizedPriorityLabel = priorityLabel.toLowerCase();
      if (normalizedLabels.includes(normalizedPriorityLabel)) {
        const mappedType = this.labelMapping[normalizedPriorityLabel];
        if (mappedType && availableTypes.includes(mappedType)) {
          return mappedType;
        }
      }
    }

    // Fallback to first-match if no priority labels found
    return this.mapFirstMatch(normalizedLabels, availableTypes);
  }

  /**
   * Get default GitHub label mappings
   * Provides sensible defaults for common GitHub labels
   */
  static getDefaultMappings(): Record<string, string> {
    return {
      'bug': 'Bug',
      'enhancement': 'Feature',
      'feature': 'Feature',
      'improvement': 'Improvement',
      'chore': 'Chore',
      'task': 'Task',
      'documentation': 'Chore',
      'refactor': 'Improvement',
      'performance': 'Improvement',
      'security': 'Bug',
      'hotfix': 'Bug'
    };
  }

  /**
   * Get default priority order for GitHub labels
   * Prioritizes more specific/important labels first
   */
  static getDefaultPriority(): string[] {
    return [
      'bug',
      'security',
      'hotfix',
      'feature',
      'enhancement',
      'improvement',
      'performance',
      'refactor',
      'chore',
      'documentation',
      'task'
    ];
  }

  /**
   * Create a mapper with default GitHub configuration
   */
  static createWithDefaults(overrides?: Partial<LabelMappingConfig>): GitHubLabelTypeMapper {
    const defaultConfig: LabelMappingConfig = {
      labelToTypeMapping: GitHubLabelTypeMapper.getDefaultMappings(),
      defaultTaskType: 'Task',
      mappingStrategy: 'priority-based',
      labelPriority: GitHubLabelTypeMapper.getDefaultPriority()
    };

    return new GitHubLabelTypeMapper({ ...defaultConfig, ...overrides });
  }
}
