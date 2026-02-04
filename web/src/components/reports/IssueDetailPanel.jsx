import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../ui'

function IssueDetailPanel({ issue, onClose, screenshots = [] }) {
  const { t } = useTranslation(['pages', 'common'])
  const panelRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  if (!issue) return null

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pass':
      case 'passed':
        return <span className="text-green-500">✅</span>
      case 'fail':
      case 'failed':
        return <span className="text-red-500">❌</span>
      case 'warning':
        return <span className="text-yellow-500">⚠️</span>
      default:
        return <span className="text-gray-400">○</span>
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b bg-gray-50 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center space-x-2 mb-1">
                {getStatusIcon(issue.status)}
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeverityColor(issue.severity)}`}>
                  {issue.severity?.toUpperCase() || 'INFO'}
                </span>
                {issue.testCaseId && (
                  <span className="px-2 py-0.5 text-xs font-mono bg-blue-100 text-blue-700 rounded">
                    {issue.testCaseId}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                {issue.title || 'Issue Details'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Description */}
          {issue.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                {issue.description}
              </p>
            </div>
          )}

          {/* Template Info */}
          {(issue.baseTemplate || issue.compareTemplate) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Templates</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                {issue.baseTemplate && (
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-20">Base:</span>
                    <span className="font-mono text-gray-800">{issue.baseTemplate}</span>
                  </div>
                )}
                {issue.compareTemplate && (
                  <div className="flex items-center text-sm">
                    <span className="text-gray-500 w-20">Compare:</span>
                    <span className="font-mono text-gray-800">{issue.compareTemplate}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Differences */}
          {issue.differences && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Differences Found</h3>
              <div className="space-y-3">
                {/* Color differences */}
                {issue.differences.colors && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Color Changes</p>
                    <div className="flex flex-wrap gap-2">
                      {issue.differences.colors.added?.map((color, idx) => (
                        <div key={`added-${idx}`} className="flex items-center space-x-1">
                          <span className="text-green-600 text-xs">+</span>
                          <div
                            className="w-5 h-5 rounded border border-gray-300"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                          <span className="text-xs font-mono text-gray-600">{color}</span>
                        </div>
                      ))}
                      {issue.differences.colors.removed?.map((color, idx) => (
                        <div key={`removed-${idx}`} className="flex items-center space-x-1">
                          <span className="text-red-600 text-xs">-</span>
                          <div
                            className="w-5 h-5 rounded border border-gray-300"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                          <span className="text-xs font-mono text-gray-600">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content differences */}
                {issue.differences.content?.changes?.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Content Changes</p>
                    <div className="space-y-1 max-h-32 overflow-auto">
                      {issue.differences.content.changes.slice(0, 10).map((change, idx) => (
                        <div
                          key={idx}
                          className={`text-xs px-2 py-1 rounded ${
                            change.type === 'added'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          <span className="font-mono">{change.type === 'added' ? '+' : '-'}</span>
                          {' '}{change.value}
                        </div>
                      ))}
                    </div>
                    {issue.differences.content.totalChanges > 10 && (
                      <p className="text-xs text-gray-400 mt-2">
                        ...and {issue.differences.content.totalChanges - 10} more changes
                      </p>
                    )}
                  </div>
                )}

                {/* Structure differences */}
                {issue.differences.structure?.differences?.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Structure Changes</p>
                    <div className="space-y-1">
                      {issue.differences.structure.differences.map((diff, idx) => (
                        <div key={idx} className="flex items-center text-xs">
                          <span className="text-gray-600 w-24">{diff.element}:</span>
                          <span className="text-red-600">{diff.base}</span>
                          <span className="mx-2 text-gray-400">→</span>
                          <span className="text-green-600">{diff.compare}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Screenshots Section */}
          {screenshots.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Screenshots</h3>
              <div className="space-y-4">
                {screenshots.map((screenshot, idx) => (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-700">
                          {screenshot.template}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {screenshot.viewport}
                        </span>
                      </div>
                      {screenshot.dimensions && (
                        <span className="text-xs text-gray-400">
                          {screenshot.dimensions.width}×{screenshot.dimensions.height}
                        </span>
                      )}
                    </div>
                    <div className="relative bg-gray-100">
                      {screenshot.loading ? (
                        <div className="h-48 flex items-center justify-center">
                          <LoadingSpinner />
                        </div>
                      ) : screenshot.error ? (
                        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                          <div className="text-center">
                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Screenshot not available
                          </div>
                        </div>
                      ) : (
                        <img
                          src={screenshot.url}
                          alt={`${screenshot.template} - ${screenshot.viewport}`}
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(screenshot.url, '_blank')}
                        />
                      )}

                      {/* Difference markers overlay */}
                      {screenshot.markers?.length > 0 && (
                        <div className="absolute inset-0 pointer-events-none">
                          {screenshot.markers.map((marker, mIdx) => (
                            <div
                              key={mIdx}
                              className="absolute border-2 border-red-500 bg-red-500/10 rounded"
                              style={{
                                left: `${marker.x}%`,
                                top: `${marker.y}%`,
                                width: `${marker.width}%`,
                                height: `${marker.height}%`,
                              }}
                              title={marker.description}
                            >
                              <span className="absolute -top-5 left-0 text-xs bg-red-500 text-white px-1 rounded">
                                {marker.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected Result */}
          {issue.expectedResult && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Expected Result</h3>
              <p className="text-sm text-gray-600 bg-green-50 border border-green-200 rounded-lg p-3">
                {issue.expectedResult}
              </p>
            </div>
          )}

          {/* Actual Result */}
          {issue.actualResult && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Actual Result</h3>
              <p className="text-sm text-gray-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {issue.actualResult}
              </p>
            </div>
          )}

          {/* Recommendations */}
          {issue.recommendations?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h3>
              <ul className="space-y-2">
                {issue.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span className="text-gray-600">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analysis */}
          {issue.analysis && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Analysis</h3>
              <p className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                {issue.analysis}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t bg-gray-50 px-6 py-3">
          <div className="flex items-center justify-between text-xs text-gray-500">
            {issue.comparedAt && (
              <span>Analyzed: {new Date(issue.comparedAt).toLocaleString()}</span>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              {t('common:buttons.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IssueDetailPanel
