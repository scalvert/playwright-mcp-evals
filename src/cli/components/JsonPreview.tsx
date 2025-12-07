import { Box, Text } from 'ink';

interface JsonPreviewProps {
  data: unknown;
  maxLines?: number;
}

/**
 * Displays JSON data with optional truncation
 */
export function JsonPreview({ data, maxLines = 15 }: JsonPreviewProps) {
  const formatted = JSON.stringify(data, null, 2);
  const lines = formatted.split('\n');
  const truncated = lines.length > maxLines;
  const displayLines = truncated ? lines.slice(0, maxLines) : lines;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      {displayLines.map((line, i) => (
        <Text key={i} dimColor>
          {line}
        </Text>
      ))}
      {truncated && (
        <Text dimColor italic>
          ... ({lines.length - maxLines} more lines)
        </Text>
      )}
    </Box>
  );
}
