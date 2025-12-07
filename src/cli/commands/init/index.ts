import { render } from 'ink';
import React from 'react';
import { InitApp, type InitOptions } from './InitApp.js';

/**
 * Init command action handler using Ink
 */
export async function init(options: InitOptions): Promise<void> {
  const { waitUntilExit } = render(React.createElement(InitApp, { options }));
  await waitUntilExit();
}

export type { InitOptions };
