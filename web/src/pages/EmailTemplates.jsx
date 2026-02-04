import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import mjml2html from 'mjml-browser'
import { VIEWPORTS, TIMEOUTS, API_ENDPOINTS } from '../constants'
import { NotificationToast } from '../components/ui'
import {
  TemplateList,
  TemplateToolbar,
  CreateTemplateModal,
} from '../components/templates'

function EmailTemplates() {
  const { t } = useTranslation(['pages', 'common', 'messages'])

  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedForTest, setSelectedForTest] = useState([])
  const [viewMode, setViewMode] = useState('preview')
  const [viewport, setViewport] = useState(VIEWPORTS[0])
  const [editedSource, setEditedSource] = useState('')
  const [compiledHtml, setCompiledHtml] = useState('')
  const [compileError, setCompileError] = useState(null)
  const [testData, setTestData] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [customWidth, setCustomWidth] = useState(600)
  const [notification, setNotification] = useState(null)
  const [testsRunning, setTestsRunning] = useState(false)

  const showNotification = (type, message) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), TIMEOUTS.NOTIFICATION)
  }

  useEffect(() => {
    loadTemplates()
    loadTestData()
    checkTestStatus()
  }, [])

  // Poll for test status to disable buttons when tests are running
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

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch(API_ENDPOINTS.TEMPLATES)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates)
        if (data.templates.length > 0 && !selectedTemplate) {
          selectTemplate(data.templates[0])
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadTestData = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_DATA)
      if (res.ok) {
        const data = await res.json()
        setTestData(data)
      }
    } catch (err) {
      console.error('Failed to load test data:', err)
    }
  }

  const selectTemplate = async (template) => {
    setSelectedTemplate(template)
    setHasChanges(false)
    setCompileError(null)

    try {
      const res = await fetch(`/templates/emails/${template.file}`)
      if (res.ok) {
        const source = await res.text()
        setEditedSource(source)
        compileMjml(source)
      }
    } catch (err) {
      console.error('Failed to load template:', err)
    }
  }

  const compileMjml = useCallback((mjmlSource) => {
    try {
      let processedSource = mjmlSource
      const ctx = testData?.context || {}

      const baseVars = {
        context: ctx,
        company: {
          name: ctx.companyName || 'Carebox',
          address: ctx.companyAddress || '123 Main Street, San Francisco, CA 94102',
          logoUrl: ctx.logoUrl || '/templates/shared/carebox_logo.png',
          supportEmail: ctx.supportEmail || 'support@example.com'
        },
        visitor: { name: ctx.visitorName || 'Valued Visitor' },
        urls: {
          cta: ctx.ctaUrl || 'https://example.com/get-started',
          privacy: ctx.privacyUrl || 'https://example.com/privacy',
          terms: ctx.termsUrl || 'https://example.com/terms',
          unsubscribe: ctx.unsubscribeUrl || 'https://example.com/unsubscribe'
        },
        currentYear: ctx.currentYear || new Date().getFullYear(),
        primaryColor: '#2563eb',
        headingColor: '#1f2937',
        bgColor: '#f4f4f5',
        title: '',
        previewText: ''
      }

      const codeBlocks = []
      processedSource.replace(/<%(?![-=#%])([\s\S]*?)%>/g, (match, code) => {
        codeBlocks.push(code)
        return match
      })

      if (codeBlocks.length > 0) {
        try {
          let combinedCode = codeBlocks.join('\n')
            .replace(/\bconst\s+/g, 'var ')
            .replace(/\blet\s+/g, 'var ')

          const fn = new Function(`
            var context = arguments[0];
            var company = arguments[1];
            var visitor = arguments[2];
            var urls = arguments[3];
            var currentYear = arguments[4];
            var locals = { context: context, company: company, visitor: visitor, urls: urls, currentYear: currentYear };
            ${combinedCode}
            return {
              company: typeof company !== 'undefined' ? company : null,
              visitor: typeof visitor !== 'undefined' ? visitor : null,
              urls: typeof urls !== 'undefined' ? urls : null,
              currentYear: typeof currentYear !== 'undefined' ? currentYear : null,
              primaryColor: typeof primaryColor !== 'undefined' ? primaryColor : null,
              headingColor: typeof headingColor !== 'undefined' ? headingColor : null,
              bgColor: typeof bgColor !== 'undefined' ? bgColor : null,
              title: typeof title !== 'undefined' ? title : null,
              previewText: typeof previewText !== 'undefined' ? previewText : null
            };
          `)

          const result = fn(baseVars.context, baseVars.company, baseVars.visitor, baseVars.urls, baseVars.currentYear)

          if (result.primaryColor) baseVars.primaryColor = result.primaryColor
          if (result.headingColor) baseVars.headingColor = result.headingColor
          if (result.bgColor) baseVars.bgColor = result.bgColor
          if (result.title) baseVars.title = result.title
          if (result.previewText) baseVars.previewText = result.previewText
          if (result.company) baseVars.company = result.company
          if (result.visitor) baseVars.visitor = result.visitor
          if (result.urls) baseVars.urls = result.urls
          if (result.currentYear) baseVars.currentYear = result.currentYear
        } catch (e) {
          console.warn('Error evaluating template code:', e.message)
        }
      }

      processedSource = processedSource.replace(/<%#[\s\S]*?%>/g, '')
      processedSource = processedSource.replace(/<%(?![-=#%])[\s\S]*?%>/g, '')
      processedSource = processedSource.replace(/<%=\s*([\s\S]*?)%>/g, (match, expr) => {
        try {
          const fn = new Function(
            'context', 'company', 'visitor', 'urls', 'currentYear',
            'primaryColor', 'headingColor', 'bgColor', 'title', 'previewText',
            `return (${expr.trim()});`
          )
          const result = fn(
            baseVars.context, baseVars.company, baseVars.visitor, baseVars.urls, baseVars.currentYear,
            baseVars.primaryColor, baseVars.headingColor, baseVars.bgColor, baseVars.title, baseVars.previewText
          )
          return result !== undefined && result !== null ? String(result) : ''
        } catch (e) {
          console.warn('Error evaluating expression:', expr, e.message)
          return ''
        }
      })

      const result = mjml2html(processedSource, { validationLevel: 'soft' })

      if (result.errors?.length > 0) {
        setCompileError(result.errors.map(e => e.formattedMessage || e.message).join('\n'))
      } else {
        setCompileError(null)
      }

      setCompiledHtml(result.html)
    } catch (error) {
      setCompileError(error.message)
      setCompiledHtml(`<p style="color: red; padding: 20px;">${t('messages:error.compilationError', { error: error.message })}</p>`)
    }
  }, [testData, t])

  const handleSourceChange = (e) => {
    const newSource = e.target.value
    setEditedSource(newSource)
    setHasChanges(true)
    compileMjml(newSource)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    setSaving(true)
    try {
      const res = await fetch(API_ENDPOINTS.SAVE_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: selectedTemplate.file, content: editedSource })
      })
      if (res.ok) {
        setHasChanges(false)
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToSave', { error: err.message }))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (selectedTemplate) {
      selectTemplate(selectedTemplate)
    }
  }

  const handleDelete = async (template) => {
    if (!confirm(t('messages:confirm.deleteTemplate', { name: template.name }))) return

    try {
      const res = await fetch(API_ENDPOINTS.DELETE_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: template.file })
      })
      if (res.ok) {
        loadTemplates()
        if (selectedTemplate?.file === template.file) {
          setSelectedTemplate(null)
        }
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToDelete', { error: err.message }))
    }
  }

  const handleCreate = async () => {
    if (!newTemplateName.trim()) return

    try {
      const res = await fetch(API_ENDPOINTS.CREATE_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName, copyFrom: copyFrom || null })
      })
      if (res.ok) {
        setShowCreateModal(false)
        setNewTemplateName('')
        setCopyFrom('')
        loadTemplates()
      } else {
        const err = await res.json()
        showNotification('error', err.error || t('messages:error.failedToCreate', { error: 'Unknown error' }))
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToCreate', { error: err.message }))
    }
  }

  const toggleTestSelection = (template) => {
    setSelectedForTest(prev =>
      prev.includes(template.file)
        ? prev.filter(f => f !== template.file)
        : [...prev, template.file]
    )
  }

  const runSelectedTests = async () => {
    if (testsRunning) {
      return // Tests already running
    }

    if (selectedForTest.length === 0) {
      showNotification('warning', t('messages:warning.noTemplatesSelected'))
      return
    }

    try {
      const res = await fetch(API_ENDPOINTS.RUN_TESTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: selectedForTest })
      })
      if (res.ok) {
        setTestsRunning(true)
        showNotification('success', t('messages:success.testsStartedProgress'))
      }
    } catch (err) {
      showNotification('error', t('messages:error.failedToStartTests', { error: err.message }))
    }
  }

  const handleViewportChange = (vp) => {
    setViewport(vp)
  }

  const handleCustomWidthChange = (width) => {
    setCustomWidth(width)
    setViewport({ name: 'Custom', width, icon: 'custom' })
  }

  const handleDuplicateClick = (template) => {
    setCopyFrom(template.file)
    setNewTemplateName(template.name + ' Copy')
    setShowCreateModal(true)
  }

  const getBreakpointLabel = () => {
    const width = viewport.name === 'Custom' ? customWidth : viewport.width
    if (width <= 480) return t('pages:emailTemplates.breakpoint.mobile')
    if (width <= 768) return t('pages:emailTemplates.breakpoint.tablet')
    return t('pages:emailTemplates.breakpoint.desktop')
  }

  const getBreakpointColor = () => {
    const width = viewport.name === 'Custom' ? customWidth : viewport.width
    if (width <= 480) return 'bg-red-500'
    if (width <= 768) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const ViewportIcon = ({ icon }) => {
    switch (icon) {
      case 'desktop':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      case 'tablet':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      case 'mobile':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
      case 'custom':
        return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
      default:
        return null
    }
  }

  return (
    <div className="flex h-full relative">
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />

      <TemplateList
        templates={templates}
        selectedTemplate={selectedTemplate}
        selectedForTest={selectedForTest}
        loading={loading}
        testsRunning={testsRunning}
        onSelectTemplate={selectTemplate}
        onToggleTestSelection={toggleTestSelection}
        onCreateClick={() => setShowCreateModal(true)}
        onDuplicateClick={handleDuplicateClick}
        onDeleteClick={handleDelete}
        onRefresh={loadTemplates}
        onRunSelectedTests={runSelectedTests}
        onClearSelection={() => setSelectedForTest([])}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gray-100">
        {selectedTemplate ? (
          <>
            <TemplateToolbar
              selectedTemplate={selectedTemplate}
              viewMode={viewMode}
              viewport={viewport}
              customWidth={customWidth}
              hasChanges={hasChanges}
              saving={saving}
              onViewModeChange={setViewMode}
              onViewportChange={handleViewportChange}
              onCustomWidthChange={handleCustomWidthChange}
              onSave={handleSave}
              onReset={handleReset}
            />

            {/* Compile Error */}
            {compileError && (
              <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
                <strong>Error:</strong> {compileError}
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              {viewMode === 'preview' && (
                <div className="h-full flex flex-col bg-gray-200">
                  {/* Viewport indicator bar */}
                  <div className="bg-gray-800 text-white px-4 py-2 flex items-center justify-center space-x-4 text-xs">
                    <span className="flex items-center space-x-2">
                      <ViewportIcon icon={viewport.icon} />
                      <span className="font-medium">{viewport.name}</span>
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">
                      {viewport.name === 'Custom' ? customWidth : viewport.width}px
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className={`px-2 py-0.5 rounded ${getBreakpointColor()}`}>
                      {getBreakpointLabel()}
                    </span>
                  </div>
                  {/* Preview container */}
                  <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    <div
                      className="bg-white shadow-xl transition-all duration-300 overflow-auto rounded-lg"
                      style={{
                        width: viewport.name === 'Custom' ? customWidth : viewport.width,
                        maxWidth: '100%',
                        height: 'calc(100% - 16px)'
                      }}
                    >
                      <iframe
                        srcDoc={compiledHtml}
                        className="w-full h-full border-0"
                        title="Preview"
                      />
                    </div>
                  </div>
                </div>
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
                <pre className="h-full p-4 font-mono text-sm bg-gray-900 text-gray-100 overflow-auto">
                  <code>{compiledHtml}</code>
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-lg">{t('pages:emailTemplates.selectToEdit')}</p>
              <p className="text-sm mt-1">{t('pages:emailTemplates.orCreateNew')}</p>
            </div>
          </div>
        )}
      </div>

      <CreateTemplateModal
        show={showCreateModal}
        templates={templates}
        newTemplateName={newTemplateName}
        copyFrom={copyFrom}
        onNameChange={setNewTemplateName}
        onCopyFromChange={setCopyFrom}
        onCreate={handleCreate}
        onClose={() => {
          setShowCreateModal(false)
          setNewTemplateName('')
          setCopyFrom('')
        }}
      />
    </div>
  )
}

export default EmailTemplates
