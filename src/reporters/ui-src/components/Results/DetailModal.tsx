import React from 'react';
import type { EvalCaseResult } from '../../types';

interface DetailModalProps {
  result: EvalCaseResult | null;
  onClose: () => void;
}

export function DetailModal({ result, onClose }: DetailModalProps) {
  if (!result) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-card rounded-lg border shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-muted/50">
            <h2 className="text-xl font-semibold">Case: {result.id}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-accent transition-colors"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
            {/* Status and Metadata */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  result.pass
                    ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                    : 'bg-red-500/20 text-red-700 dark:text-red-400'
                }`}
              >
                {result.pass ? '✓ Pass' : '✗ Fail'}
              </span>

              {/* Source badge */}
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  result.source === 'eval'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                }`}
              >
                {result.source === 'eval' ? 'Eval Dataset' : 'Test Suite'}
              </span>

              {/* Auth type badge */}
              {result.authType && (
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    result.authType === 'oauth'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : result.authType === 'api-token'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {result.authType === 'api-token'
                    ? 'API Token'
                    : result.authType === 'oauth'
                      ? 'OAuth'
                      : 'No Auth'}
                </span>
              )}

              {/* Project badge */}
              {result.project && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                  {result.project}
                </span>
              )}
            </div>

            {/* Error */}
            {result.error && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Error
                </h3>
                <pre className="bg-destructive/10 text-destructive p-4 rounded-md text-sm overflow-x-auto">
                  {result.error}
                </pre>
              </div>
            )}

            {/* Response */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Response
              </h3>
              <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto font-mono">
                {JSON.stringify(result.response, null, 2)}
              </pre>
            </div>

            {/* Expectations */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Expectations
              </h3>
              <div className="space-y-3">
                {Object.entries(result.expectations)
                  .filter(([_, exp]) => exp !== undefined)
                  .map(([type, exp]) => (
                    <div
                      key={type}
                      className={`p-4 rounded-md border-l-4 ${
                        exp.pass
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-red-500 bg-red-500/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-sm font-semibold ${
                            exp.pass
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {exp.pass ? '✓' : '✗'} {type}
                        </span>
                      </div>
                      {exp.details && (
                        <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                          {exp.details}
                        </pre>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            {/* Performance */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Performance
              </h3>
              <p className="text-sm">
                Duration: <strong>{result.durationMs.toFixed(2)}ms</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
