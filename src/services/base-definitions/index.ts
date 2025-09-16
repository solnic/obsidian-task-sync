/**
 * Base Definitions Export Module
 * Simple declarative base generation functions
 */

// Main exports
export { PropertyDefinition, PROPERTY_REGISTRY } from "../../types/properties";

export {
  FilterCondition,
  PropertyFilter,
  FileSystemFilter,
  CustomFilter,
  CompositeFilter,
  FilterBuilder,
} from "../../types/filters";

export {
  generateTasksBase,
  generateAreaBase,
  generateProjectBase,
  generateParentTaskBase,
  generateTaskFrontMatter,
  generateProjectFrontMatter,
  generateAreaFrontMatter,
  ProjectAreaInfo,
  PROPERTY_SETS,
  VIEW_ORDERS,
  SORT_CONFIGS,
  FILTER_PRESETS,
} from "./BaseConfigurations";
