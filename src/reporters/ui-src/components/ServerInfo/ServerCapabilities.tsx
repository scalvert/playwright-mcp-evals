import React, { useMemo } from 'react';
import { Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import type { MCPServerCapabilitiesData } from '../../types';

interface ServerCapabilitiesProps {
  serverCapabilities: MCPServerCapabilitiesData[];
  isExpanded: boolean;
  onToggle: () => void;
}

interface ToolInfo {
  name: string;
  description?: string;
}

export function ServerCapabilities({
  serverCapabilities,
  isExpanded,
  onToggle,
}: ServerCapabilitiesProps) {

  // Deduplicate tools across all capability reports
  const uniqueTools = useMemo(() => {
    const toolMap = new Map<string, ToolInfo>();

    for (const cap of serverCapabilities) {
      for (const tool of cap.tools) {
        // Keep the first description we find for each tool
        if (!toolMap.has(tool.name)) {
          toolMap.set(tool.name, tool);
        }
      }
    }

    return Array.from(toolMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [serverCapabilities]);

  if (!serverCapabilities || serverCapabilities.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header - Clickable */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 border-b bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <Wrench className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold">Server Capabilities</h3>
          </div>
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {uniqueTools.length} tools available
          </span>
        </div>
      </button>

      {/* Tools List - Collapsible with fixed height */}
      {isExpanded && (
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {uniqueTools.map((tool) => (
            <div
              key={tool.name}
              className="px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 mt-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-semibold font-mono text-foreground">
                    {tool.name}
                  </code>
                  {tool.description && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {tool.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
