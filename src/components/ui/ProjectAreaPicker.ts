/**
 * Project and Area picker component for the Task Sync plugin
 * Provides a reusable dropdown/picker for selecting projects and areas
 */

import { Setting } from 'obsidian';
import { Project, Area } from '../../types/entities';

export interface PickerOptions {
  allowEmpty?: boolean;
  placeholder?: string;
  showCreateNew?: boolean;
  onCreateNew?: () => void;
}

export interface PickerData {
  projects: Project[];
  areas: Area[];
}

/**
 * Project picker component
 */
export class ProjectPicker {
  private containerEl: HTMLElement;
  private setting: Setting;
  private projects: Project[];
  private selectedProjectId: string | null = null;
  private options: PickerOptions;
  private onChangeCallback?: (projectId: string | null) => void;

  constructor(containerEl: HTMLElement, projects: Project[], options: PickerOptions = {}) {
    this.containerEl = containerEl;
    this.projects = projects;
    this.options = {
      allowEmpty: true,
      placeholder: 'Select a project...',
      showCreateNew: false,
      ...options
    };
    this.createPicker();
  }

  private createPicker(): void {
    this.setting = new Setting(this.containerEl)
      .setName('Project')
      .setDesc('Select a project for this task');

    this.setting.addDropdown(dropdown => {
      // Add empty option if allowed
      if (this.options.allowEmpty) {
        dropdown.addOption('', this.options.placeholder || 'No project');
      }

      // Add project options
      this.projects.forEach(project => {
        dropdown.addOption(project.id, project.name);
      });

      // Add "Create New" option if enabled
      if (this.options.showCreateNew) {
        dropdown.addOption('__create_new__', '+ Create New Project');
      }

      dropdown.setValue(this.selectedProjectId || '')
        .onChange((value) => {
          if (value === '__create_new__') {
            this.options.onCreateNew?.();
            // Reset to empty after triggering create new
            dropdown.setValue('');
            return;
          }
          
          this.selectedProjectId = value || null;
          this.onChangeCallback?.(this.selectedProjectId);
        });
    });
  }

  public onChange(callback: (projectId: string | null) => void): ProjectPicker {
    this.onChangeCallback = callback;
    return this;
  }

  public setValue(projectId: string | null): void {
    this.selectedProjectId = projectId;
    this.setting.components.forEach(component => {
      if ('setValue' in component) {
        (component as any).setValue(projectId || '');
      }
    });
  }

  public getValue(): string | null {
    return this.selectedProjectId;
  }

  public updateProjects(projects: Project[]): void {
    this.projects = projects;
    // Recreate the picker with new data
    this.setting.settingEl.remove();
    this.createPicker();
  }

  public getSelectedProject(): Project | null {
    if (!this.selectedProjectId) return null;
    return this.projects.find(p => p.id === this.selectedProjectId) || null;
  }
}

/**
 * Area picker component
 */
export class AreaPicker {
  private containerEl: HTMLElement;
  private setting: Setting;
  private areas: Area[];
  private selectedAreaId: string | null = null;
  private options: PickerOptions;
  private onChangeCallback?: (areaId: string | null) => void;

  constructor(containerEl: HTMLElement, areas: Area[], options: PickerOptions = {}) {
    this.containerEl = containerEl;
    this.areas = areas;
    this.options = {
      allowEmpty: true,
      placeholder: 'Select an area...',
      showCreateNew: false,
      ...options
    };
    this.createPicker();
  }

  private createPicker(): void {
    this.setting = new Setting(this.containerEl)
      .setName('Area')
      .setDesc('Select an area for this task');

    this.setting.addDropdown(dropdown => {
      // Add empty option if allowed
      if (this.options.allowEmpty) {
        dropdown.addOption('', this.options.placeholder || 'No area');
      }

      // Add area options
      this.areas.forEach(area => {
        dropdown.addOption(area.id, area.name);
      });

      // Add "Create New" option if enabled
      if (this.options.showCreateNew) {
        dropdown.addOption('__create_new__', '+ Create New Area');
      }

      dropdown.setValue(this.selectedAreaId || '')
        .onChange((value) => {
          if (value === '__create_new__') {
            this.options.onCreateNew?.();
            // Reset to empty after triggering create new
            dropdown.setValue('');
            return;
          }
          
          this.selectedAreaId = value || null;
          this.onChangeCallback?.(this.selectedAreaId);
        });
    });
  }

  public onChange(callback: (areaId: string | null) => void): AreaPicker {
    this.onChangeCallback = callback;
    return this;
  }

  public setValue(areaId: string | null): void {
    this.selectedAreaId = areaId;
    this.setting.components.forEach(component => {
      if ('setValue' in component) {
        (component as any).setValue(areaId || '');
      }
    });
  }

  public getValue(): string | null {
    return this.selectedAreaId;
  }

  public updateAreas(areas: Area[]): void {
    this.areas = areas;
    // Recreate the picker with new data
    this.setting.settingEl.remove();
    this.createPicker();
  }

  public getSelectedArea(): Area | null {
    if (!this.selectedAreaId) return null;
    return this.areas.find(a => a.id === this.selectedAreaId) || null;
  }
}

/**
 * Combined project and area picker component
 */
export class ProjectAreaPicker {
  private containerEl: HTMLElement;
  private projectPicker: ProjectPicker;
  private areaPicker: AreaPicker;
  private data: PickerData;
  private options: PickerOptions;

  constructor(containerEl: HTMLElement, data: PickerData, options: PickerOptions = {}) {
    this.containerEl = containerEl;
    this.data = data;
    this.options = options;
    this.createPickers();
  }

  private createPickers(): void {
    // Create project picker
    const projectContainer = this.containerEl.createDiv('task-sync-picker-group');
    this.projectPicker = new ProjectPicker(projectContainer, this.data.projects, {
      ...this.options,
      onCreateNew: () => {
        this.options.onCreateNew?.();
      }
    });

    // Create area picker
    const areaContainer = this.containerEl.createDiv('task-sync-picker-group');
    this.areaPicker = new AreaPicker(areaContainer, this.data.areas, {
      ...this.options,
      onCreateNew: () => {
        this.options.onCreateNew?.();
      }
    });

    // Set up cross-picker logic (e.g., filter projects by selected area)
    this.areaPicker.onChange((areaId) => {
      this.updateProjectsForArea(areaId);
    });
  }

  private updateProjectsForArea(areaId: string | null): void {
    if (!areaId) {
      // Show all projects if no area selected
      this.projectPicker.updateProjects(this.data.projects);
      return;
    }

    // Filter projects by selected area
    const filteredProjects = this.data.projects.filter(p => p.areaId === areaId);
    this.projectPicker.updateProjects(filteredProjects);
    
    // Clear project selection if current project doesn't belong to selected area
    const currentProject = this.projectPicker.getSelectedProject();
    if (currentProject && currentProject.areaId !== areaId) {
      this.projectPicker.setValue(null);
    }
  }

  public onProjectChange(callback: (projectId: string | null) => void): ProjectAreaPicker {
    this.projectPicker.onChange(callback);
    return this;
  }

  public onAreaChange(callback: (areaId: string | null) => void): ProjectAreaPicker {
    this.areaPicker.onChange(callback);
    return this;
  }

  public setProjectValue(projectId: string | null): void {
    this.projectPicker.setValue(projectId);
  }

  public setAreaValue(areaId: string | null): void {
    this.areaPicker.setValue(areaId);
    this.updateProjectsForArea(areaId);
  }

  public getProjectValue(): string | null {
    return this.projectPicker.getValue();
  }

  public getAreaValue(): string | null {
    return this.areaPicker.getValue();
  }

  public getSelectedProject(): Project | null {
    return this.projectPicker.getSelectedProject();
  }

  public getSelectedArea(): Area | null {
    return this.areaPicker.getSelectedArea();
  }

  public updateData(data: PickerData): void {
    this.data = data;
    this.projectPicker.updateProjects(data.projects);
    this.areaPicker.updateAreas(data.areas);
  }

  public getValues(): { projectId: string | null; areaId: string | null } {
    return {
      projectId: this.getProjectValue(),
      areaId: this.getAreaValue()
    };
  }

  public setValues(values: { projectId?: string | null; areaId?: string | null }): void {
    if (values.areaId !== undefined) {
      this.setAreaValue(values.areaId);
    }
    if (values.projectId !== undefined) {
      this.setProjectValue(values.projectId);
    }
  }
}

/**
 * Utility function to create a simple project picker
 */
export function createProjectPicker(
  containerEl: HTMLElement, 
  projects: Project[], 
  options?: PickerOptions
): ProjectPicker {
  return new ProjectPicker(containerEl, projects, options);
}

/**
 * Utility function to create a simple area picker
 */
export function createAreaPicker(
  containerEl: HTMLElement, 
  areas: Area[], 
  options?: PickerOptions
): AreaPicker {
  return new AreaPicker(containerEl, areas, options);
}

/**
 * Utility function to create a combined project and area picker
 */
export function createProjectAreaPicker(
  containerEl: HTMLElement, 
  data: PickerData, 
  options?: PickerOptions
): ProjectAreaPicker {
  return new ProjectAreaPicker(containerEl, data, options);
}
