import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerProps {
  label: string;
}

/**
 * Loading spinner with label text
 */
export function Spinner({ label }: SpinnerProps) {
  return (
    <Box>
      <Text color="cyan">
        <InkSpinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Box>
  );
}
