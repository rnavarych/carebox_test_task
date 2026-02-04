import { useTranslation } from 'react-i18next'
import { VIEWPORTS, MIN_VIEWPORT_WIDTH, MAX_VIEWPORT_WIDTH } from '../../constants'

const ViewportIcon = ({ icon }) => {
  switch (icon) {
    case 'desktop':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    case 'tablet':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    case 'mobile':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    case 'custom':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      )
    default:
      return null
  }
}

function ViewportSelector({ viewport, customWidth, onViewportChange, onCustomWidthChange }) {
  const { t } = useTranslation('common')

  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-gray-500 font-medium">{t('labels.responsive')}:</span>
      <div className="flex bg-gray-100 rounded-lg p-1">
        {VIEWPORTS.filter(vp => vp.icon !== 'custom').map((vp) => (
          <button
            key={vp.name}
            onClick={() => onViewportChange(vp)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center space-x-1.5 ${
              viewport.name === vp.name
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title={`${vp.name} (${vp.width}px)`}
          >
            <ViewportIcon icon={vp.icon} />
            <span>{vp.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center space-x-1 ml-2">
        <input
          type="number"
          value={viewport.name === 'Custom' ? customWidth : viewport.width}
          onChange={(e) => {
            const width = parseInt(e.target.value) || MIN_VIEWPORT_WIDTH
            onCustomWidthChange(width)
          }}
          className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          min={MIN_VIEWPORT_WIDTH}
          max={MAX_VIEWPORT_WIDTH}
        />
        <span className="text-xs text-gray-400">{t('units.px')}</span>
      </div>
    </div>
  )
}

export default ViewportSelector
