import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { API_ENDPOINTS, TIMEOUTS } from '../constants'
import { NotificationToast } from '../components/ui'
import { ApiKeySection, AutoTestSection, UsageSection } from '../components/settings'

function Settings() {
  const { t } = useTranslation(['pages', 'common', 'messages'])

  const [apiKey, setApiKey] = useState('')
  const [maskedKey, setMaskedKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [notification, setNotification] = useState(null)
  const [keyInfo, setKeyInfo] = useState({ hasDefaultKey: false, usingDefault: true, canRestore: false })
  const [restoring, setRestoring] = useState(false)
  const [autoTestEnabled, setAutoTestEnabled] = useState(false)
  const [savingAutoTest, setSavingAutoTest] = useState(false)

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), TIMEOUTS.NOTIFICATION)
  }

  useEffect(() => {
    loadApiKey()
    loadAutoTestSetting()
  }, [])

  const loadAutoTestSetting = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.AUTO_TEST)
      if (res.ok) {
        const data = await res.json()
        setAutoTestEnabled(data.enabled || false)
      }
    } catch {
      console.error('Failed to load auto-test setting')
    }
  }

  const toggleAutoTest = async () => {
    setSavingAutoTest(true)
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.AUTO_TEST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !autoTestEnabled })
      })
      if (res.ok) {
        setAutoTestEnabled(!autoTestEnabled)
        showNotification('success', !autoTestEnabled
          ? t('messages:success.autoTestEnabled')
          : t('messages:success.autoTestDisabled'))
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToUpdateAutoTest'))
    } finally {
      setSavingAutoTest(false)
    }
  }

  const loadApiKey = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.API_KEY)
      if (res.ok) {
        const data = await res.json()
        if (data.maskedKey) {
          setMaskedKey(data.maskedKey)
          setApiKey(data.maskedKey)
        }
        setKeyInfo({
          hasDefaultKey: data.hasDefaultKey || false,
          usingDefault: data.usingDefault !== false,
          canRestore: data.canRestore || false
        })
      }
    } catch (err) {
      console.error('Failed to load API key:', err)
    }
  }

  const handleSave = async () => {
    if (!apiKey || apiKey === maskedKey) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      })
      if (res.ok) {
        setSaved(true)
        const data = await res.json()
        setMaskedKey(data.maskedKey)
        setApiKey(data.maskedKey)
        setShowKey(false)
        setKeyInfo(prev => ({ ...prev, usingDefault: false, hasCustomKey: true, canRestore: prev.hasDefaultKey }))
        setTestResult(null)
        setTimeout(() => setSaved(false), TIMEOUTS.SUCCESS_MESSAGE)
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToSaveApiKey', { error: err.message }))
    } finally {
      setSaving(false)
    }
  }

  const testApiKey = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.TEST_API_KEY, {
        method: 'POST'
      })
      const data = await res.json()
      setTestResult(data)
      if (data.success) {
        fetchUsage()
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTesting(false)
    }
  }

  const restoreDefaultKey = async () => {
    setRestoring(true)
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.RESTORE_DEFAULT, {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        setMaskedKey(data.maskedKey)
        setApiKey(data.maskedKey)
        setKeyInfo(prev => ({ ...prev, usingDefault: true, canRestore: false }))
        setTestResult(null)
        showNotification('success', t('messages:success.restoredDefaultKey'))
      } else {
        const error = await res.json()
        showNotification('error', error.error || t('messages:error.failedToRestoreKey', { error: 'Unknown error' }))
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToRestoreKey', { error: err.message }))
    } finally {
      setRestoring(false)
    }
  }

  const fetchUsage = async () => {
    setLoadingUsage(true)
    try {
      const res = await fetch(API_ENDPOINTS.SETTINGS.USAGE)
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setLoadingUsage(false)
    }
  }

  return (
    <div className="h-full flex flex-col relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800">{t('pages:settings.title')}</h1>
        <p className="text-sm text-gray-500">{t('pages:settings.subtitle')}</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          <ApiKeySection
            apiKey={apiKey}
            maskedKey={maskedKey}
            showKey={showKey}
            saving={saving}
            saved={saved}
            testing={testing}
            testResult={testResult}
            keyInfo={keyInfo}
            restoring={restoring}
            onApiKeyChange={setApiKey}
            onToggleShowKey={() => setShowKey(!showKey)}
            onSave={handleSave}
            onTestApiKey={testApiKey}
            onRestoreDefaultKey={restoreDefaultKey}
          />

          <AutoTestSection
            enabled={autoTestEnabled}
            saving={savingAutoTest}
            onToggle={toggleAutoTest}
          />

          <UsageSection
            usage={usage}
            maskedKey={maskedKey}
            loading={loadingUsage}
            onRefresh={fetchUsage}
          />

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex space-x-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">{t('pages:settings.info.title')}</p>
                <ul className="mt-2 space-y-1 text-blue-700">
                  <li>• {t('pages:settings.info.keyStoredLocally')}</li>
                  <li>• {t('pages:settings.info.defaultModel')}</li>
                  <li>• {t('pages:settings.info.tokensPerTest')}</li>
                  <li>• {t('pages:settings.info.costPerTest')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
