/**
 * Tests for shared Ink CLI components
 */

import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { Spinner } from './Spinner.js';
import { StatusMessage } from './StatusMessage.js';
import { JsonPreview } from './JsonPreview.js';

describe('Spinner', () => {
  it('renders with label', () => {
    const { lastFrame } = render(React.createElement(Spinner, { label: 'Loading...' }));
    expect(lastFrame()).toContain('Loading...');
  });

  it('renders with different labels', () => {
    const { lastFrame } = render(React.createElement(Spinner, { label: 'Connecting to server...' }));
    expect(lastFrame()).toContain('Connecting to server...');
  });
});

describe('StatusMessage', () => {
  it('renders success status with checkmark', () => {
    const { lastFrame } = render(
      React.createElement(StatusMessage, { status: 'success' }, 'Operation completed')
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('\u2713'); // checkmark
    expect(frame).toContain('Operation completed');
  });

  it('renders error status with X', () => {
    const { lastFrame } = render(
      React.createElement(StatusMessage, { status: 'error' }, 'Something went wrong')
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('\u2717'); // X mark
    expect(frame).toContain('Something went wrong');
  });

  it('renders info status with info icon', () => {
    const { lastFrame } = render(
      React.createElement(StatusMessage, { status: 'info' }, 'Information message')
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('\u2139'); // info icon
    expect(frame).toContain('Information message');
  });

  it('renders warning status with warning icon', () => {
    const { lastFrame } = render(
      React.createElement(StatusMessage, { status: 'warning' }, 'Warning message')
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('\u26A0'); // warning icon
    expect(frame).toContain('Warning message');
  });
});

describe('JsonPreview', () => {
  it('renders simple object', () => {
    const data = { name: 'test', value: 123 };
    const { lastFrame } = render(React.createElement(JsonPreview, { data }));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('name');
    expect(frame).toContain('test');
    expect(frame).toContain('value');
    expect(frame).toContain('123');
  });

  it('renders array', () => {
    const data = [1, 2, 3];
    const { lastFrame } = render(React.createElement(JsonPreview, { data }));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('1');
    expect(frame).toContain('2');
    expect(frame).toContain('3');
  });

  it('renders nested object', () => {
    const data = { outer: { inner: 'value' } };
    const { lastFrame } = render(React.createElement(JsonPreview, { data }));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('outer');
    expect(frame).toContain('inner');
    expect(frame).toContain('value');
  });

  it('respects maxLines limit', () => {
    const data = { a: 1, b: 2, c: 3, d: 4, e: 5 };
    const { lastFrame } = render(React.createElement(JsonPreview, { data, maxLines: 3 }));
    const frame = lastFrame() ?? '';
    // Should show truncation indicator
    expect(frame).toContain('...');
  });

  it('handles null data', () => {
    const { lastFrame } = render(React.createElement(JsonPreview, { data: null }));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('null');
  });

  it('handles string data', () => {
    const { lastFrame } = render(React.createElement(JsonPreview, { data: 'hello world' }));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('hello world');
  });
});
