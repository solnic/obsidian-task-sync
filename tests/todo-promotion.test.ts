/**
 * Tests for todo promotion functionality
 */

import { describe, it, expect } from 'vitest';
import { TodoItem, FileContext } from '../src/main';

/**
 * Helper function to parse todo items from text lines
 * This mirrors the logic from the plugin's detectTodoUnderCursor method
 */
function parseTodoLine(line: string, lineNumber: number = 0): TodoItem | null {
  // Regex to match todo items: optional whitespace, list marker (- or *), checkbox, text
  const todoRegex = /^(\s*)([-*])\s*\[([xX\s])\]\s*(.+)$/;
  const match = line.match(todoRegex);

  if (!match) {
    return null;
  }

  const [, indentation, listMarker, checkboxState, text] = match;

  return {
    text: text.trim(),
    completed: checkboxState.toLowerCase() === 'x',
    indentation,
    listMarker,
    lineNumber
  };
}

/**
 * Helper function to generate replacement line for promoted todo
 */
function generateReplacementLine(todoItem: TodoItem): string {
  if (todoItem.completed) {
    // Keep the completed checkbox and add the link
    return `${todoItem.indentation}${todoItem.listMarker} [x] [[${todoItem.text}]]`;
  } else {
    // Replace with a simple link
    return `${todoItem.indentation}${todoItem.listMarker} [[${todoItem.text}]]`;
  }
}

describe('Todo Promotion', () => {

  describe('parseTodoLine', () => {
    it('should detect incomplete todo item', () => {
      const result = parseTodoLine('- [ ] Buy groceries', 0);

      expect(result).toEqual({
        text: 'Buy groceries',
        completed: false,
        indentation: '',
        listMarker: '-',
        lineNumber: 0
      });
    });

    it('should detect completed todo item', () => {
      const result = parseTodoLine('  * [x] Finish project', 1);

      expect(result).toEqual({
        text: 'Finish project',
        completed: true,
        indentation: '  ',
        listMarker: '*',
        lineNumber: 1
      });
    });

    it('should detect indented todo item', () => {
      const result = parseTodoLine('    - [ ] Nested task item', 2);

      expect(result).toEqual({
        text: 'Nested task item',
        completed: false,
        indentation: '    ',
        listMarker: '-',
        lineNumber: 2
      });
    });

    it('should return null for non-todo lines', () => {
      const result = parseTodoLine('This is just regular text');

      expect(result).toBeNull();
    });

    it('should return null for list items without checkboxes', () => {
      const result = parseTodoLine('- Regular list item');

      expect(result).toBeNull();
    });

    it('should handle various checkbox states', () => {
      // Test uppercase X
      const resultX = parseTodoLine('- [X] Completed task');
      expect(resultX?.completed).toBe(true);

      // Test lowercase x
      const resultx = parseTodoLine('- [x] Completed task');
      expect(resultx?.completed).toBe(true);

      // Test space (incomplete)
      const resultSpace = parseTodoLine('- [ ] Incomplete task');
      expect(resultSpace?.completed).toBe(false);
    });

    it('should handle different list markers', () => {
      const dashResult = parseTodoLine('- [ ] Dash marker');
      expect(dashResult?.listMarker).toBe('-');

      const asteriskResult = parseTodoLine('* [ ] Asterisk marker');
      expect(asteriskResult?.listMarker).toBe('*');
    });

    it('should preserve indentation', () => {
      const result = parseTodoLine('      - [ ] Deeply indented');
      expect(result?.indentation).toBe('      ');
    });
  });

  describe('generateReplacementLine', () => {
    it('should generate simple link for incomplete todo', () => {
      const todoItem: TodoItem = {
        text: 'Buy groceries',
        completed: false,
        indentation: '',
        listMarker: '-',
        lineNumber: 0
      };

      const result = generateReplacementLine(todoItem);
      expect(result).toBe('- [[Buy groceries]]');
    });

    it('should preserve completion state for completed todo', () => {
      const todoItem: TodoItem = {
        text: 'Finish project',
        completed: true,
        indentation: '  ',
        listMarker: '*',
        lineNumber: 1
      };

      const result = generateReplacementLine(todoItem);
      expect(result).toBe('  * [x] [[Finish project]]');
    });

    it('should preserve indentation and list marker', () => {
      const todoItem: TodoItem = {
        text: 'Nested task',
        completed: false,
        indentation: '    ',
        listMarker: '-',
        lineNumber: 2
      };

      const result = generateReplacementLine(todoItem);
      expect(result).toBe('    - [[Nested task]]');
    });

    it('should handle different list markers', () => {
      const dashTodo: TodoItem = {
        text: 'Dash task',
        completed: false,
        indentation: '',
        listMarker: '-',
        lineNumber: 0
      };

      const asteriskTodo: TodoItem = {
        text: 'Asterisk task',
        completed: false,
        indentation: '',
        listMarker: '*',
        lineNumber: 0
      };

      expect(generateReplacementLine(dashTodo)).toBe('- [[Dash task]]');
      expect(generateReplacementLine(asteriskTodo)).toBe('* [[Asterisk task]]');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete todo promotion workflow', () => {
      // Parse a todo line
      const todoItem = parseTodoLine('  - [ ] Complete the documentation', 5);
      expect(todoItem).not.toBeNull();

      // Generate replacement line
      const replacementLine = generateReplacementLine(todoItem!);
      expect(replacementLine).toBe('  - [[Complete the documentation]]');

      // Verify the todo item properties
      expect(todoItem!.text).toBe('Complete the documentation');
      expect(todoItem!.completed).toBe(false);
      expect(todoItem!.indentation).toBe('  ');
      expect(todoItem!.listMarker).toBe('-');
      expect(todoItem!.lineNumber).toBe(5);
    });

    it('should handle completed todo promotion workflow', () => {
      // Parse a completed todo line
      const todoItem = parseTodoLine('    * [x] Review pull request', 10);
      expect(todoItem).not.toBeNull();

      // Generate replacement line
      const replacementLine = generateReplacementLine(todoItem!);
      expect(replacementLine).toBe('    * [x] [[Review pull request]]');

      // Verify the todo item properties
      expect(todoItem!.text).toBe('Review pull request');
      expect(todoItem!.completed).toBe(true);
      expect(todoItem!.indentation).toBe('    ');
      expect(todoItem!.listMarker).toBe('*');
      expect(todoItem!.lineNumber).toBe(10);
    });
  });
});
