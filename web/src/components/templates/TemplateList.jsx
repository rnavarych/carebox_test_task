import { useTranslation } from 'react-i18next'
import { getTemplateTypeColor, getTemplateTypeLabel } from '../../constants'
import { LoadingSpinner } from '../ui'

function TemplateList({
  templates,
  selectedTemplate,
  selectedForTest,
  loading,
  testsRunning,
  onSelectTemplate,
  onToggleTestSelection,
  onCreateClick,
  onDuplicateClick,
  onDeleteClick,
  onRefresh,
  onRunSelectedTests,
  onClearSelection,
}) {
  const { t } = useTranslation(['pages', 'common'])

  return (
    <div className="w-72 bg-white border-r flex flex-col">
      {/* Sidebar Header */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">{t('pages:emailTemplates.title')}</h2>
          <button
            onClick={onCreateClick}
            className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            title={t('pages:emailTemplates.createTemplate')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Test Selection Actions */}
        {selectedForTest.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{selectedForTest.length} {t('common:labels.selected')}</span>
            <div className="space-x-2">
              <button
                onClick={onClearSelection}
                className="text-gray-500 hover:text-gray-700"
              >
                {t('common:buttons.clear')}
              </button>
              <button
                onClick={onRunSelectedTests}
                disabled={testsRunning}
                className={`px-2 py-1 rounded text-xs ${
                  testsRunning
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {testsRunning ? t('common:labels.running') : t('common:buttons.runTests')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Template List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <LoadingSpinner text={t('common:labels.loading')} />
          </div>
        ) : (
          <div className="p-2">
            {templates.map((template) => (
              <div
                key={template.file}
                className={`group relative mb-2 rounded-lg border transition-all ${
                  selectedTemplate?.file === template.file
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* Checkbox for test selection */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2">
                  <input
                    type="checkbox"
                    checked={selectedForTest.includes(template.file)}
                    onChange={() => onToggleTestSelection(template)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Template Info */}
                <div
                  className="pl-8 pr-2 py-3 pb-4 cursor-pointer"
                  onClick={() => onSelectTemplate(template)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {template.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {template.file}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded border ${getTemplateTypeColor(template.type)}`}>
                      {getTemplateTypeLabel(template.type)}
                    </span>
                  </div>

                  {template.description && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {template.description}
                    </div>
                  )}
                </div>

                {/* Actions - Bottom Right Corner */}
                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 flex space-x-1 bg-white/95 rounded-lg shadow-sm border border-gray-200 px-1 py-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicateClick(template)
                    }}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title={t('common:buttons.duplicate')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteClick(template)
                    }}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title={t('common:buttons.delete')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>{templates.length} templates</span>
          <button
            onClick={onRefresh}
            className="text-blue-600 hover:text-blue-700"
          >
            {t('common:buttons.refresh')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TemplateList
