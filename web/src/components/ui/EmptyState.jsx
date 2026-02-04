function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  actionHref,
  actionDisabled = false,
  actionDisabledLabel,
  className = '',
}) {
  const defaultIcon = (
    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )

  const displayLabel = actionDisabled && actionDisabledLabel ? actionDisabledLabel : actionLabel

  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="flex justify-center mb-4">
        {icon || defaultIcon}
      </div>
      {title && (
        <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-500 mb-4">{description}</p>
      )}
      {actionHref && actionLabel && (
        actionDisabled ? (
          <span className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-400 text-gray-200 rounded-lg font-medium cursor-not-allowed">
            <span>{displayLabel}</span>
          </span>
        ) : (
          <a
            href={actionHref}
            onClick={action}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            <span>{displayLabel}</span>
          </a>
        )
      )}
      {action && actionLabel && !actionHref && (
        <button
          onClick={action}
          disabled={actionDisabled}
          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium ${
            actionDisabled
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <span>{displayLabel}</span>
        </button>
      )}
    </div>
  )
}

export default EmptyState
