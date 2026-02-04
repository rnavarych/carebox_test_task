import { useTranslation } from 'react-i18next'
import { LoadingSpinner } from '../ui'

function UsageSection({ usage, maskedKey, loading, onRefresh }) {
  const { t } = useTranslation(['pages', 'common'])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800 flex items-center space-x-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{t('pages:settings.usage.title')}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('pages:settings.usage.subtitle')}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading || !maskedKey}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center space-x-1"
        >
          {loading ? <LoadingSpinner size="sm" /> : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          <span>{t('common:buttons.refresh')}</span>
        </button>
      </div>
      <div className="p-4">
        {!maskedKey ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p>{t('pages:settings.usage.addKeyToView')}</p>
          </div>
        ) : usage?.note ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-600 mb-4">{usage.note}</p>
            <a
              href="https://console.anthropic.com/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <span>{t('pages:settings.usage.viewBilling')}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        ) : usage ? (
          <div className="space-y-4">
            {/* Balance Card */}
            {usage.balance !== undefined && (
              <div className={`p-4 rounded-lg ${
                usage.balance < 5 ? 'bg-red-50 border border-red-200' :
                usage.balance < 20 ? 'bg-yellow-50 border border-yellow-200' :
                'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{t('common:labels.availableBalance')}</p>
                    <p className={`text-3xl font-bold ${
                      usage.balance < 5 ? 'text-red-700' :
                      usage.balance < 20 ? 'text-yellow-700' :
                      'text-green-700'
                    }`}>
                      {formatCurrency(usage.balance)}
                    </p>
                  </div>
                  {usage.balance < 5 && (
                    <div className="text-right">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {t('common:status.lowBalance')}
                      </span>
                      <a
                        href="https://console.anthropic.com/settings/billing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-red-600 hover:text-red-800 mt-1"
                      >
                        {t('common:buttons.addCredits')} →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Usage Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{t('common:labels.tokensUsed')}</p>
                <p className="text-xl font-semibold text-gray-800">
                  {usage.tokensUsed?.toLocaleString() || '—'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">{t('common:labels.estimatedCost')}</p>
                <p className="text-xl font-semibold text-gray-800">
                  {usage.estimatedCost ? formatCurrency(usage.estimatedCost) : '—'}
                </p>
              </div>
            </div>

            {/* Rate Limit Info */}
            {usage.rateLimit && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800">{t('common:labels.rateLimitStatus')}</p>
                <div className="mt-2 flex items-center space-x-4 text-sm text-blue-700">
                  <span>{t('common:labels.requests')}: {usage.rateLimit.requestsRemaining}/{usage.rateLimit.requestsLimit}</span>
                  <span>{t('common:labels.tokens')}: {usage.rateLimit.tokensRemaining?.toLocaleString()}/{usage.rateLimit.tokensLimit?.toLocaleString()}</span>
                </div>
              </div>
            )}

            {usage.lastUpdated && (
              <p className="text-xs text-gray-400 text-right">
                {t('common:labels.lastUpdated')}: {new Date(usage.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>{t('pages:settings.usage.clickRefresh')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default UsageSection
