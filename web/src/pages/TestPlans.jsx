import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { API_ENDPOINTS, TIMEOUTS } from '../constants'
import { LoadingSpinner, EmptyState } from '../components/ui'
import { useTestCompletion } from '../hooks'

function TestPlans() {
  const { t } = useTranslation(['pages', 'common', 'messages'])
  const [testPlans, setTestPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [testsRunning, setTestsRunning] = useState(false)

  // Auto-refresh when tests complete
  const refreshAllData = useCallback(() => {
    fetchTestPlans()
  }, [])

  useTestCompletion(refreshAllData)

  useEffect(() => {
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

  const fetchTestPlans = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_PLANS)
      if (res.ok) {
        const data = await res.json()
        setTestPlans(data.plans || [])
        if (data.plans?.length > 0 && !selectedPlan) {
          setSelectedPlan(data.plans[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch test plans:', err)
    } finally {
      setLoading(false)
    }
  }

  const deletePlan = async (plan, e) => {
    e.stopPropagation()

    let confirmMessage = t('messages:confirm.deleteTestPlan', { id: plan.testPlanId || plan.id })
    if (plan.linkedReport || plan.linkedLog) {
      confirmMessage += '\n\n' + t('messages:confirm.deleteLinkedItems')
      if (plan.linkedReport) confirmMessage += '\n- Report: ' + plan.linkedReport.id
      if (plan.linkedLog) confirmMessage += '\n- Log: ' + plan.linkedLog.file
    }

    if (!confirm(confirmMessage)) return

    try {
      const res = await fetch(API_ENDPOINTS.DELETE_TEST_PLAN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id })
      })
      if (res.ok) {
        setTestPlans(testPlans.filter(p => p.id !== plan.id))
        if (selectedPlan?.id === plan.id) {
          setSelectedPlan(null)
        }
      }
    } catch (err) {
      console.error('Failed to delete test plan:', err)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t('pages:testPlans.title')}</h1>
            <p className="text-sm text-gray-500">{t('pages:testPlans.subtitle')}</p>
          </div>
          <button
            onClick={fetchTestPlans}
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
        {/* Plans List */}
        <div className="w-80 flex-shrink-0 bg-white rounded-lg shadow flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-800">Test Plans History</h2>
            <p className="text-xs text-gray-500">{testPlans.length} plan(s) available</p>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <LoadingSpinner />
              </div>
            ) : testPlans.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                }
                title={t('pages:testPlans.noPlans')}
                description={t('pages:testPlans.runTestsToGenerate')}
                actionLabel={testsRunning ? t('common:labels.running') : t('common:buttons.runAllTests')}
                action={runAllTests}
                actionDisabled={testsRunning}
                className="py-12"
              />
            ) : (
              testPlans.map(plan => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedPlan?.id === plan.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {plan.testPlanId || `Plan ${plan.id}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(plan.createdAt)}
                        </p>
                        {plan.linkedReport && (
                          <Link
                            to={`/reports?id=${plan.linkedReport.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`inline-flex items-center space-x-1 text-xs mt-2 px-2 py-1 rounded-full ${
                              plan.linkedReport.status === 'passed' ? 'bg-green-100 text-green-700' :
                              plan.linkedReport.status === 'failed' ? 'bg-red-100 text-red-700' :
                              plan.linkedReport.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>View Report ({plan.linkedReport.status})</span>
                          </Link>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-2">
                        {plan.testSuites && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {plan.testSuites.length} suites
                          </span>
                        )}
                        <button
                          onClick={(e) => deletePlan(plan, e)}
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
                )
              )
            )}
          </div>
        </div>

        {/* Plan Details */}
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col min-w-0">
          {selectedPlan ? (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-800">
                      {selectedPlan.testPlanId || 'Test Plan Details'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Created: {formatDate(selectedPlan.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedPlan.linkedReport && (
                      <Link
                        to={`/reports?id=${selectedPlan.linkedReport.id}`}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center space-x-2 ${
                          selectedPlan.linkedReport.status === 'passed' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                          selectedPlan.linkedReport.status === 'failed' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                          selectedPlan.linkedReport.status === 'warning' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                          'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>View Report ({selectedPlan.linkedReport.status})</span>
                      </Link>
                    )}
                    <button
                      onClick={(e) => deletePlan(selectedPlan, e)}
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
              </div>
              <div className="flex-1 overflow-auto p-4">
                {/* Template Context */}
                {selectedPlan.templateContext && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-800 mb-3">Template Context</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm">
                        <span className="text-gray-500">Base Template:</span>{' '}
                        <span className="font-medium">{selectedPlan.templateContext.baseTemplate}</span>
                      </p>
                      {selectedPlan.templateContext.variations && (
                        <p className="text-sm mt-2">
                          <span className="text-gray-500">Variations:</span>{' '}
                          {selectedPlan.templateContext.variations.join(', ')}
                        </p>
                      )}
                      {selectedPlan.templateContext.expectedDifferences && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-500 mb-1">Expected Differences:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(selectedPlan.templateContext.expectedDifferences).map(([key, value]) => (
                              <div key={key} className="text-sm bg-white rounded px-2 py-1">
                                <span className="font-medium">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Test Suites */}
                {selectedPlan.testSuites && selectedPlan.testSuites.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-800 mb-3">Test Suites</h3>
                    <div className="space-y-4">
                      {selectedPlan.testSuites.map((suite, idx) => (
                        <div key={idx} className="border rounded-lg">
                          <div className="p-4 bg-gray-50 border-b">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-800">{suite.name}</h4>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                suite.priority === 'critical' ? 'bg-red-100 text-red-700' :
                                suite.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                suite.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {suite.priority}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{suite.description}</p>
                          </div>
                          {suite.testCases && suite.testCases.length > 0 && (
                            <div className="p-4">
                              <p className="text-sm text-gray-500 mb-2">
                                {suite.testCases.length} test case(s)
                              </p>
                              <div className="space-y-3">
                                {suite.testCases.map((tc, tcIdx) => (
                                  <div key={tcIdx} className="text-sm border-l-2 border-gray-200 pl-3">
                                    <p className="font-medium text-gray-800">
                                      <span className="text-gray-400">[{tc.id}]</span> {tc.name}
                                    </p>
                                    <p className="text-gray-600 mt-1">{tc.description}</p>
                                    {tc.expectedResult && (
                                      <p className="text-gray-500 mt-1">
                                        <span className="font-medium">Expected:</span> {tc.expectedResult}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk Assessment */}
                {selectedPlan.riskAssessment && (
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-800 mb-3">Risk Assessment</h3>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      {selectedPlan.riskAssessment.highRiskAreas && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-yellow-800">High Risk Areas:</p>
                          <ul className="list-disc list-inside text-sm text-yellow-700 mt-1">
                            {selectedPlan.riskAssessment.highRiskAreas.map((area, idx) => (
                              <li key={idx}>{area}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedPlan.riskAssessment.mitigations && (
                        <div>
                          <p className="text-sm font-medium text-yellow-800">Mitigations:</p>
                          <ul className="list-disc list-inside text-sm text-yellow-700 mt-1">
                            {selectedPlan.riskAssessment.mitigations.map((m, idx) => (
                              <li key={idx}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {selectedPlan.summary && (
                  <div>
                    <h3 className="font-medium text-gray-800 mb-3">Summary</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                      {selectedPlan.summary}
                    </p>
                  </div>
                )}

                {/* Raw Data (if parse error) */}
                {selectedPlan.parseError && selectedPlan.rawResponse && (
                  <div className="mt-6">
                    <h3 className="font-medium text-gray-800 mb-3">Raw Response</h3>
                    <pre className="text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto max-h-96">
                      {selectedPlan.rawResponse}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <EmptyState
                icon={
                  <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                title="Select a test plan to view details"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TestPlans
