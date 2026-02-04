import { useTranslation } from 'react-i18next'
import ViewportSelector from './ViewportSelector'

function TemplateToolbar({
  selectedTemplate,
  viewMode,
  viewport,
  customWidth,
  hasChanges,
  saving,
  onViewModeChange,
  onViewportChange,
  onCustomWidthChange,
  onSave,
  onReset,
}) {
  const { t } = useTranslation(['pages', 'common'])

  return (
    <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {/* Template Info */}
        <div>
          <h3 className="font-semibold text-gray-800">{selectedTemplate.name}</h3>
          <p className="text-xs text-gray-500">emails/{selectedTemplate.file}</p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['preview', 'edit', 'html'].map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t(`pages:emailTemplates.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Viewport Selector (for preview mode) */}
        {viewMode === 'preview' && (
          <ViewportSelector
            viewport={viewport}
            customWidth={customWidth}
            onViewportChange={onViewportChange}
            onCustomWidthChange={onCustomWidthChange}
          />
        )}

        {/* Save/Reset buttons */}
        {hasChanges && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-yellow-600">{t('common:labels.unsavedChanges')}</span>
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              {t('common:buttons.reset')}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? t('common:labels.saving') : t('common:buttons.save')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplateToolbar
