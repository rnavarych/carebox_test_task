import { useTranslation } from 'react-i18next'
import { Toggle } from '../ui'

function AutoTestSection({ enabled, saving, onToggle }) {
  const { t } = useTranslation('pages')

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-gray-800 flex items-center space-x-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{t('settings.autoTest.title')}</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('settings.autoTest.subtitle')}
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">{t('settings.autoTest.enable')}</p>
            <p className="text-sm text-gray-500">
              {t('settings.autoTest.description')}
            </p>
          </div>
          <Toggle enabled={enabled} onChange={onToggle} disabled={saving} />
        </div>
        {enabled && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Auto-testing is enabled</p>
                <p className="text-blue-700 mt-1">
                  {t('settings.autoTest.enabledInfo')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AutoTestSection
