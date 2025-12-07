import { render } from 'ink';
import React from 'react';
import { GenerateApp, type GenerateOptions } from './GenerateApp.js';

/**
 * Generate command action handler using Ink
 */
export async function generate(options: GenerateOptions): Promise<void> {
  const { waitUntilExit } = render(
    React.createElement(GenerateApp, { options })
  );
  await waitUntilExit();
}

export type { GenerateOptions };
