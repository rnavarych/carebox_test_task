import { useTranslation } from 'react-i18next'

function CreateTemplateModal({
  show,
  templates,
  newTemplateName,
  copyFrom,
  onNameChange,
  onCopyFromChange,
  onCreate,
  onClose,
}) {
  const { t } = useTranslation(['pages', 'common'])

  if (!show) return null

  const fileName = newTemplateName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'template_name'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {copyFrom ? t('pages:emailTemplates.duplicateTemplate') : t('pages:emailTemplates.createNew')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common:labels.templateName')}
            </label>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t('common:placeholders.templateNameInput')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('pages:emailTemplates.fileName')}: {fileName}.mjml
            </p>
          </div>

          {!copyFrom && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common:labels.copyFrom')}
              </label>
              <select
                value={copyFrom}
                onChange={(e) => onCopyFromChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{t('common:placeholders.startFromScratch')}</option>
                {templates.map(tmpl => (
                  <option key={tmpl.file} value={tmpl.file}>{tmpl.name}</option>
                ))}
              </select>
            </div>
          )}

          {copyFrom && (
            <p className="text-sm text-gray-600">
              {t('pages:emailTemplates.copyingFrom')}: <strong>{copyFrom}</strong>
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            {t('common:buttons.cancel')}
          </button>
          <button
            onClick={onCreate}
            disabled={!newTemplateName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {copyFrom ? t('common:buttons.duplicate') : t('common:buttons.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateTemplateModal
