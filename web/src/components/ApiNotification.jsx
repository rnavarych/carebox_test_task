import { useState, useEffect } from 'react'

function ApiNotification() {
  const [notification, setNotification] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Check for API errors periodically
    const checkApiStatus = async () => {
      try {
        const res = await fetch('/api/settings/api-status')
        if (res.ok) {
          const data = await res.json()
          if (data.error) {
            setNotification({
              type: 'error',
              title: 'API Error',
              message: data.error,
              action: data.action
            })
            setVisible(true)
          } else if (data.warning) {
            setNotification({
              type: 'warning',
              title: 'API Warning',
              message: data.warning,
              action: data.action
            })
            setVisible(true)
          } else {
            setVisible(false)
          }
        }
      } catch (err) {
        // Silently fail - don't show notification for fetch errors
      }
    }

    // Check immediately and then every 30 seconds
    checkApiStatus()
    const interval = setInterval(checkApiStatus, 30000)

    // Listen for custom events from other components
    const handleApiError = (event) => {
      const { type, title, message, action } = event.detail
      setNotification({ type, title, message, action })
      setVisible(true)
    }

    window.addEventListener('api-notification', handleApiError)

    return () => {
      clearInterval(interval)
      window.removeEventListener('api-notification', handleApiError)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
  }

  if (!visible || !notification) return null

  const bgColor = notification.type === 'error' ? 'bg-red-600' : 'bg-yellow-500'
  const textColor = notification.type === 'error' ? 'text-white' : 'text-yellow-900'

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${bgColor} shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex items-center space-x-3">
            {notification.type === 'error' ? (
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-yellow-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <div className={textColor}>
              <span className="font-medium">{notification.title}:</span>
              <span className="ml-1">{notification.message}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {notification.action && (
              <a
                href={notification.action.url || '/settings'}
                className={`text-sm font-medium underline ${textColor} hover:opacity-80`}
              >
                {notification.action.label || 'Fix this'}
              </a>
            )}
            <button
              onClick={dismiss}
              className={`${textColor} hover:opacity-80`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ApiNotification
