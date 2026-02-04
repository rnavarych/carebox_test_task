import { useState, useEffect, useCallback } from 'react'
import mjml2html from 'mjml-browser'

function TemplatePreview({ template, sourceCode, testData, onSave, onSourceChange }) {
  const [viewMode, setViewMode] = useState('preview')
  const [editedSource, setEditedSource] = useState(sourceCode)
  const [compiledHtml, setCompiledHtml] = useState('')
  const [compileError, setCompileError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Compile MJML to HTML using mjml-browser
  const compileMjml = useCallback((mjmlSource) => {
    try {
      // First compile MJML to HTML
      const result = mjml2html(mjmlSource, {
        validationLevel: 'soft'
      })

      if (result.errors && result.errors.length > 0) {
        setCompileError(result.errors.map(e => e.formattedMessage || e.message).join('\n'))
      } else {
        setCompileError(null)
      }

      // Then render EJS variables with test data
      let html = result.html
      if (testData) {
        // Simple EJS-like replacement for preview
        html = html.replace(/<%=\s*context\.(\w+)\s*%>/g, (match, key) => {
          return testData.context?.[key] || match
        })
      }

      setCompiledHtml(html)
    } catch (error) {
      setCompileError(error.message)
      setCompiledHtml(`<p style="color: red; padding: 20px;">Compilation Error: ${error.message}</p>`)
    }
  }, [testData])

  // Compile on source change
  useEffect(() => {
    setEditedSource(sourceCode)
    compileMjml(sourceCode)
    setHasChanges(false)
  }, [sourceCode, compileMjml])

  // Handle source edit
  const handleSourceChange = (e) => {
    const newSource = e.target.value
    setEditedSource(newSource)
    setHasChanges(newSource !== sourceCode)
    compileMjml(newSource)
    if (onSourceChange) {
      onSourceChange(newSource)
    }
  }

  // Handle save
  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(template.folder, editedSource)
      setHasChanges(false)
    } catch (error) {
      alert(`Failed to save: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Reset changes
  const handleReset = () => {
    setEditedSource(sourceCode)
    setHasChanges(false)
    compileMjml(sourceCode)
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
      <div className="p-4 bg-gray-50 border-b flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="font-semibold text-gray-800">{template.name}</h3>
          <p className="text-sm text-gray-600">{template.description}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('preview')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'preview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('edit')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'edit'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => setViewMode('html')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'html'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            HTML
          </button>
        </div>
      </div>

      {compileError && (
        <div className="p-2 bg-red-50 border-b border-red-200 text-red-700 text-sm flex-shrink-0">
          <strong>Compile Error:</strong> {compileError}
        </div>
      )}

      {hasChanges && (
        <div className="p-2 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between flex-shrink-0">
          <span className="text-yellow-700 text-sm">Unsaved changes</span>
          <div className="space-x-2">
            <button
              onClick={handleReset}
              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-[400px]">
        {viewMode === 'preview' && (
          <iframe
            srcDoc={compiledHtml}
            className="w-full h-full border-0"
            title={`Preview: ${template.name}`}
          />
        )}
        {viewMode === 'edit' && (
          <textarea
            value={editedSource}
            onChange={handleSourceChange}
            className="w-full h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
            spellCheck={false}
          />
        )}
        {viewMode === 'html' && (
          <pre className="p-4 text-sm bg-gray-900 text-gray-100 h-full overflow-auto">
            <code>{compiledHtml}</code>
          </pre>
        )}
      </div>
    </div>
  )
}

export default TemplatePreview
