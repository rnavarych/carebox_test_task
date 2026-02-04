import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PIPELINE_STEPS, getProgressSteps, getPipelineColorClasses, getLogTypeColor, API_ENDPOINTS, TIMEOUTS } from '../constants'
import { LoadingSpinner, EmptyState } from '../components/ui'

function Pipeline() {
  const { t } = useTranslation(['pages', 'common'])
  const [testStatus, setTestStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState([])
  const logsEndRef = useRef(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    let interval
    if (testStatus?.isRunning) {
      interval = setInterval(fetchStatus, TIMEOUTS.POLLING_INTERVAL)
    }
    return () => clearInterval(interval)
  }, [testStatus?.isRunning])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const fetchStatus = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_STATUS)
      if (res.ok) {
        const data = await res.json()
        setTestStatus(data)

        if (data.logs && data.logs.length > 0) {
          setLogs(data.logs.map(log => ({
            timestamp: new Date(log.timestamp).toLocaleTimeString(),
            message: log.message,
            type: log.type
          })))
        }
      }
    } catch (err) {
      console.error('Failed to fetch test status:', err)
    }
  }

  const runTests = async () => {
    if (testStatus?.isRunning) {
      return // Tests already running
    }

    setLoading(true)
    setLogs([])

    try {
      const res = await fetch(API_ENDPOINTS.RUN_TESTS, { method: 'POST' })
      const data = await res.json()

      if (data.status === 'started') {
        setTestStatus(prev => ({ ...prev, isRunning: true }))
      }
    } catch (err) {
      console.error('Failed to start test:', err)
    } finally {
      setLoading(false)
    }
  }

  const progressSteps = getProgressSteps()
  const currentStep = testStatus?.currentTest?.step || null
  const currentStepIndex = progressSteps.findIndex(s => s.id === currentStep)

  const getStepStatus = (stepIndex) => {
    if (!testStatus?.isRunning) return 'idle'
    if (stepIndex < currentStepIndex) return 'complete'
    if (stepIndex === currentStepIndex) return 'active'
    return 'pending'
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('pages:testing.title')}</h1>
            <p className="text-sm text-gray-500">{t('pages:testing.subtitle')}</p>
          </div>
          <div className="flex items-center space-x-3">
            {testStatus?.lastResult && !testStatus?.isRunning && (
              <a
                href="/reports"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{t('common:buttons.viewReports')}</span>
              </a>
            )}
            <button
              onClick={runTests}
              disabled={loading || testStatus?.isRunning}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {(loading || testStatus?.isRunning) && <LoadingSpinner size="sm" className="text-white" />}
              <span>{testStatus?.isRunning ? t('common:labels.running') : t('common:buttons.runAllTests')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
        {/* Pipeline Steps */}
        <div className="bg-white rounded-lg shadow flex-shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="font-semibold text-gray-800">{t('pages:testing.pipeline.title')}</h2>
              {testStatus?.isRunning && (
                <span className="text-sm text-blue-600 flex items-center space-x-1">
                  <LoadingSpinner size="sm" />
                  <span>{testStatus.currentTest?.stepDescription || t('common:labels.processing')}</span>
                </span>
              )}
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2">
              {progressSteps.map((step, index) => {
                const status = getStepStatus(index)
                const colorClasses = getPipelineColorClasses(step.color)
                const isActive = status === 'active'
                const isComplete = status === 'complete'

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className={`flex-1 p-3 rounded-lg border-2 transition-all duration-300 ${
                      isActive
                        ? `${colorClasses.bg} ${colorClasses.border} scale-105 shadow-md`
                        : isComplete
                          ? 'bg-green-50 border-green-300'
                          : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all ${
                          isActive
                            ? `${colorClasses.badge} animate-pulse`
                            : isComplete
                              ? 'bg-green-500'
                              : 'bg-gray-400'
                        }`}>
                          {isComplete ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span>{step.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium text-sm block truncate ${isActive ? colorClasses.text : 'text-gray-700'}`}>
                            {step.name}
                          </span>
                          {isActive && (
                            <div className="flex items-center space-x-1 mt-0.5">
                              <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {index < progressSteps.length - 1 && (
                      <div className={`w-4 h-0.5 ${isComplete ? 'bg-green-400' : 'bg-gray-300'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Console Logs */}
        <div className="bg-white rounded-lg shadow flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="font-semibold text-gray-800">{t('pages:testing.console.title')}</h2>
              <p className="text-xs text-gray-500">{t('pages:testing.console.subtitle')}</p>
            </div>
            <button
              onClick={() => setLogs([])}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              {t('common:buttons.clear')}
            </button>
          </div>
          <div className="bg-gray-900 rounded-b-lg p-4 flex-1 overflow-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-12">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>{t('pages:testing.console.noLogs')}</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`py-0.5 ${getLogTypeColor(log.type)}`}>
                  <span className="text-gray-600">[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pipeline
