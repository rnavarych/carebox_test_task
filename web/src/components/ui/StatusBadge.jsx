import { getStatusColor } from '../../constants'

function StatusBadge({ status, className = '' }) {
  const colorClass = getStatusColor(status)
  const displayStatus = status?.toUpperCase() || 'UNKNOWN'

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass} ${className}`}
    >
      {displayStatus}
    </span>
  )
}

export default StatusBadge
