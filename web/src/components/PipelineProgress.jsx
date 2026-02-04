import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PIPELINE_STEPS, getProgressSteps, API_ENDPOINTS, TIMEOUTS } from '../constants'
import { LoadingSpinner } from './ui'

function PipelineProgress() {
  const { t } = useTranslation(['messages', 'common'])
  const [status, setStatus] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let interval

    const checkStatus = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.TEST_STATUS)
        if (res.ok) {
          const data = await res.json()

          if (data.isRunning) {
            setStatus({
              isRunning: true,
              currentStep: data.currentTest?.step || 'init',
              stepDescription: data.currentTest?.stepDescription || t('messages:pipeline.init'),
              templates: data.currentTest?.templates,
              startedAt: data.currentTest?.startedAt,
              progress: data.currentTest?.progress || 0
            })
            setVisible(true)
          } else if (data.lastResult && status?.isRunning) {
            const isPassed = data.lastResult.status === 'complete'
            setStatus({
              isRunning: false,
              currentStep: isPassed ? 'complete' : 'error',
              stepDescription: isPassed
                ? t('messages:pipeline.complete')
                : t('messages:pipeline.error'),
              completedAt: data.lastResult.completedAt,
              finalStatus: isPassed ? 'passed' : 'failed'
            })
            // Keep visible until user dismisses - no auto-hide
          } else if (!data.isRunning && !status?.isRunning) {
            setVisible(false)
          }
        }
      } catch {
        // Silently fail
      }
    }

    checkStatus()
    interval = setInterval(checkStatus, TIMEOUTS.POLLING_INTERVAL)

    return () => clearInterval(interval)
  }, [status?.isRunning, t])

  if (!visible || !status) return null

  const currentStepInfo = PIPELINE_STEPS.find(s => s.id === status.currentStep) || PIPELINE_STEPS[0]
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.id === status.currentStep)
  const progressSteps = getProgressSteps()

  return (
    <div className={`${currentStepInfo.bgColor} shadow-lg transition-all duration-300 flex-shrink-0`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {status.isRunning ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="sm" className="text-white" />
                <span className="text-2xl">{currentStepInfo.icon}</span>
              </div>
            ) : (
              <span className="text-2xl">{currentStepInfo.icon}</span>
            )}

            <div className="text-white">
              <div className="font-semibold flex items-center space-x-2">
                <span>{currentStepInfo.name}</span>
                {status.templates && status.templates !== 'all' && (
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                    {t('messages:pipeline.templatesCount', {
                      count: Array.isArray(status.templates) ? status.templates.length : 1
                    })}
                  </span>
                )}
              </div>
              <div className="text-sm text-white/80">{status.stepDescription}</div>
            </div>
          </div>

          {status.isRunning && (
            <div className="hidden md:flex items-center space-x-1">
              {progressSteps.map((step, idx) => {
                const isActive = step.id === status.currentStep
                const isPast = stepIndex > idx
                return (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                        isActive
                          ? 'bg-white text-gray-800 scale-110 shadow-lg'
                          : isPast
                            ? 'bg-white/40 text-white'
                            : 'bg-white/20 text-white/60'
                      }`}
                      title={step.name}
                    >
                      {isPast ? '✓' : step.icon}
                    </div>
                    {idx < progressSteps.length - 1 && (
                      <div className={`w-4 h-0.5 ${isPast ? 'bg-white/40' : 'bg-white/20'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!status.isRunning && (
            <div className="flex items-center space-x-3">
              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                status.finalStatus === 'passed'
                  ? 'bg-white text-green-600'
                  : 'bg-white text-red-600'
              }`}>
                {status.finalStatus === 'passed' ? '✓ PASSED' : '✗ FAILED'}
              </span>

              {/* View Report Link */}
              <Link
                to="/reports"
                className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded text-sm font-medium transition-colors"
              >
                {t('common:buttons.viewReports')}
              </Link>

              {/* Close Button */}
              <button
                onClick={() => setVisible(false)}
                className="text-white/80 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {status.isRunning && (
          <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/60 transition-all duration-500 ease-out"
              style={{ width: `${((stepIndex + 1) / progressSteps.length) * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default PipelineProgress
