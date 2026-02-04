import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../ui'

function ApiKeySection({
  apiKey,
  maskedKey,
  showKey,
  saving,
  saved,
  testing,
  testResult,
  keyInfo,
  restoring,
  onApiKeyChange,
  onToggleShowKey,
  onSave,
  onTestApiKey,
  onRestoreDefaultKey,
}) {
  const { t } = useTranslation(['pages', 'common'])

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800 flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>{t('pages:settings.apiKey.title')}</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {keyInfo.usingDefault && keyInfo.hasDefaultKey
                ? t('pages:settings.apiKey.usingDefault')
                : t('pages:settings.apiKey.enterYourKey')}
            </p>
          </div>
          {keyInfo.usingDefault && keyInfo.hasDefaultKey && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
              {t('common:status.defaultKeyActive')}
            </span>
          )}
          {!keyInfo.usingDefault && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {t('common:status.customKey')}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('common:labels.apiKey')}
          </label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={t('common:placeholders.apiKeyInput')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              />
              <button
                type="button"
                onClick={onToggleShowKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={onSave}
              disabled={saving || !apiKey || apiKey === maskedKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving && <LoadingSpinner size="sm" />}
              <span>{saving ? t('common:labels.saving') : t('common:buttons.save')}</span>
            </button>
          </div>
          {saved && (
            <p className="text-sm text-green-600 mt-2 flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{t('pages:settings.apiKey.savedSuccessfully')}</span>
            </p>
          )}
        </div>

        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={onTestApiKey}
            disabled={testing || !maskedKey}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-2"
          >
            {testing ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{testing ? t('common:labels.testing') : t('common:buttons.testConnection')}</span>
          </button>

          {testResult && (
            testResult.success ? (
              <div className="flex items-center space-x-2 text-sm px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-green-700">
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Connection successful!</span>
                <span className="text-green-600 font-medium">{testResult.model}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-sm px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{testResult.error}</span>
              </div>
            )
          )}

          {testResult && !testResult.success && (keyInfo.hasDefaultKey || testResult.canRestore) && (
            <button
              onClick={onRestoreDefaultKey}
              disabled={restoring}
              className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm hover:bg-yellow-200 disabled:opacity-50 flex items-center space-x-1"
            >
              {restoring ? <LoadingSpinner size="sm" /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{t('common:buttons.restoreDefault')}</span>
            </button>
          )}
        </div>

        {/* Restore Default Key - Always visible when using custom key */}
        {keyInfo.hasDefaultKey && !keyInfo.usingDefault && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-yellow-800">
                  {t('pages:settings.apiKey.usingCustomKey')}
                </span>
              </div>
              <button
                onClick={onRestoreDefaultKey}
                disabled={restoring}
                className="px-3 py-1.5 bg-yellow-200 text-yellow-800 rounded-lg text-sm hover:bg-yellow-300 disabled:opacity-50 flex items-center space-x-1"
              >
                {restoring ? <LoadingSpinner size="sm" /> : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                <span>{t('common:buttons.restoreDefault')}</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>{t('pages:settings.apiKey.getApiKey')}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

export default ApiKeySection
