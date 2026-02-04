import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { API_ENDPOINTS, TIMEOUTS, getLogTypeColor } from '../constants'
import { LoadingSpinner, EmptyState } from '../components/ui'
import { useTestCompletion } from '../hooks'

function Logs() {
  const { t } = useTranslation(['pages', 'common', 'messages'])
  const [logs, setLogs] = useState([])
  const [selectedLog, setSelectedLog] = useState(null)
  const [logContent, setLogContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)
  const [reports, setReports] = useState([])
  const [testPlans, setTestPlans] = useState([])
  const [testsRunning, setTestsRunning] = useState(false)

  // Auto-refresh when tests complete
  const refreshAllData = useCallback(() => {
    fetchLogs()
    fetchReports()
    fetchTestPlans()
  }, [])

  useTestCompletion(refreshAllData)

  useEffect(() => {
    fetchLogs()
    fetchReports()
    fetchTestPlans()
    checkTestStatus()
  }, [])

  // Poll for test status
  useEffect(() => {
    const interval = setInterval(checkTestStatus, TIMEOUTS.POLLING_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const checkTestStatus = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_STATUS)
      if (res.ok) {
        const data = await res.json()
        setTestsRunning(data.isRunning || false)
      }
    } catch {
      // Ignore errors
    }
  }

  const runAllTests = async () => {
    if (testsRunning) return
    try {
      const res = await fetch(API_ENDPOINTS.RUN_TESTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: [] }) // Empty array = all templates
      })
      if (res.ok) {
        setTestsRunning(true)
      }
    } catch (err) {
      console.error('Failed to start tests:', err)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.LOGS)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.REPORTS)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err)
    }
  }

  const fetchTestPlans = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_PLANS)
      if (res.ok) {
        const data = await res.json()
        setTestPlans(data.plans || [])
      }
    } catch (err) {
      console.error('Failed to fetch test plans:', err)
    }
  }

  const getRelatedTestPlan = (log) => {
    if (!log?.createdAt || testPlans.length === 0) return null

    const logTime = new Date(log.createdAt).getTime()

    return testPlans.find(plan => {
      const planTime = new Date(plan.createdAt).getTime()
      const diff = Math.abs(planTime - logTime)
      return diff < 5 * 60 * 1000
    })
  }

  const getRelatedReportForLog = (log) => {
    if (!log?.createdAt || reports.length === 0) return null

    const logTime = new Date(log.createdAt).getTime()

    return reports.find(report => {
      const reportTime = new Date(report.createdAt).getTime()
      const diff = Math.abs(reportTime - logTime)
      return diff < 5 * 60 * 1000
    })
  }

  const deleteLog = async (log, e) => {
    e.stopPropagation()
    const relatedReport = getRelatedReportForLog(log)
    const relatedPlan = getRelatedTestPlan(log)

    let confirmMessage = t('messages:confirm.deleteLog', { file: log.file })
    if (relatedReport || relatedPlan) {
      confirmMessage += '\n\n' + t('messages:confirm.deleteLinkedItems')
      if (relatedReport) confirmMessage += '\n- Report: ' + relatedReport.id
      if (relatedPlan) confirmMessage += '\n- Test Plan: ' + (relatedPlan.testPlanId || relatedPlan.id)
    }

    if (!confirm(confirmMessage)) return

    try {
      const res = await fetch(API_ENDPOINTS.DELETE_LOG, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: log.file })
      })
      if (res.ok) {
        setLogs(logs.filter(l => l.file !== log.file))
        if (selectedLog?.file === log.file) {
          setSelectedLog(null)
          setLogContent('')
        }
        // Refresh reports and test plans since they may have been deleted
        fetchReports()
        fetchTestPlans()
      }
    } catch (err) {
      console.error('Failed to delete log:', err)
    }
  }

  const viewLog = async (log) => {
    setSelectedLog(log)
    setLoadingContent(true)
    try {
      const res = await fetch(`${API_ENDPOINTS.LOGS}/${log.file}`)
      if (res.ok) {
        const content = await res.text()
        setLogContent(content)
      }
    } catch (err) {
      console.error('Failed to fetch log content:', err)
      setLogContent('Error loading log file')
    } finally {
      setLoadingContent(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ` ${t('common:units.bytes')}`
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ` ${t('common:units.kilobytes')}`
    return (bytes / (1024 * 1024)).toFixed(1) + ` ${t('common:units.megabytes')}`
  }

  const parseLogLine = (line) => {
    const match = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/)
    if (match) {
      return {
        timestamp: match[1],
        type: match[2],
        message: match[3]
      }
    }
    return { message: line }
  }

  const findRelatedReport = (logFile) => {
    const match = logFile.match(/test-(.+)\.log/)
    if (match) {
      return `report-${match[1]}`
    }
    return null
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('pages:logs.title')}</h1>
            <p className="text-sm text-gray-500">{t('pages:logs.subtitle')}</p>
          </div>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{t('common:buttons.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6 flex gap-6">
        {/* Logs List */}
        <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">{t('pages:logs.logFiles')}</h2>
            <p className="text-xs text-gray-500">{logs.length} log(s) available</p>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <LoadingSpinner />
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                title={t('pages:logs.noLogs')}
                description={t('pages:logs.runTestsToGenerate')}
                actionLabel={testsRunning ? t('common:labels.running') : t('common:buttons.runAllTests')}
                action={runAllTests}
                actionDisabled={testsRunning}
                className="py-12"
              />
            ) : (
              logs.map(log => (
                <div
                  key={log.file}
                  onClick={() => viewLog(log)}
                  className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedLog?.file === log.file ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate text-sm">
                        {log.file}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(log.createdAt)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatSize(log.size)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      {findRelatedReport(log.file) && (
                        <a
                          href={`/reports?id=${findRelatedReport(log.file)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                          title={t('pages:logs.viewReport')}
                        >
                          {t('pages:logs.report')}
                        </a>
                      )}
                      <button
                        onClick={(e) => deleteLog(log, e)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title={t('common:buttons.delete')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Log Content */}
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-w-0">
          {selectedLog ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800">{selectedLog.file}</h2>
                  <p className="text-xs text-gray-500">
                    {formatDate(selectedLog.createdAt)} - {formatSize(selectedLog.size)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {findRelatedReport(selectedLog.file) && (
                    <a
                      href={`/reports?id=${findRelatedReport(selectedLog.file)}`}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{t('pages:logs.viewReport')}</span>
                    </a>
                  )}
                  <button
                    onClick={(e) => deleteLog(selectedLog, e)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 flex items-center space-x-1"
                    title={t('common:buttons.delete')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>{t('common:buttons.delete')}</span>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-gray-900 rounded-b-lg p-4 font-mono text-sm">
                {loadingContent ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingSpinner size="lg" className="text-blue-500" />
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {logContent.split('\n').map((line, idx) => {
                      const parsed = parseLogLine(line)
                      return (
                        <div key={idx} className={getLogTypeColor(parsed.type)}>
                          {parsed.timestamp && (
                            <span className="text-gray-600">[{parsed.timestamp}]</span>
                          )}
                          {parsed.type && (
                            <span className={`${getLogTypeColor(parsed.type)} ml-1`}>[{parsed.type}]</span>
                          )}
                          <span className="ml-1">{parsed.message}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <EmptyState
                title={t('pages:logs.selectLogFile')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Logs
