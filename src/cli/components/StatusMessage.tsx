import { Text } from 'ink';
import type { PropsWithChildren } from 'react';

type Status = 'success' | 'error' | 'info' | 'warning';

export interface StatusMessageProps extends PropsWithChildren {
  status: Status;
}

const icons: Record<Status, string> = {
  success: '\u2713', // checkmark
  error: '\u2717', // x mark
  info: '\u2139', // info
  warning: '\u26A0', // warning
};

const colors: Record<Status, string> = {
  success: 'green',
  error: 'red',
  info: 'cyan',
  warning: 'yellow',
};

/**
 * Status message with colored icon
 */
export function StatusMessage({ status, children }: StatusMessageProps) {
  return (
    <Text color={colors[status]}>
      {icons[status]} {children}
    </Text>
  );
}
