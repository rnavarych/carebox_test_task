export const STATUS_COLORS = {
  passed: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  pending: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-800',
}

export const getStatusColor = (status) => {
  const key = status?.toLowerCase() || 'default'
  return STATUS_COLORS[key] || STATUS_COLORS.default
}

export const LOG_TYPE_COLORS = {
  error: 'text-red-400',
  warning: 'text-yellow-400',
  success: 'text-green-400',
  step: 'text-cyan-400',
  default: 'text-gray-300',
}

export const getLogTypeColor = (type) => {
  const key = type?.toLowerCase() || 'default'
  return LOG_TYPE_COLORS[key] || LOG_TYPE_COLORS.default
}

export const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-green-100 text-green-800',
  default: 'bg-gray-100 text-gray-800',
}

export const TEMPLATE_TYPE_COLORS = {
  partner_a: 'bg-green-100 text-green-700 border-green-200',
  partner_b: 'bg-orange-100 text-orange-700 border-orange-200',
  base: 'bg-blue-100 text-blue-700 border-blue-200',
}

export const getTemplateTypeColor = (type) => {
  return TEMPLATE_TYPE_COLORS[type] || TEMPLATE_TYPE_COLORS.base
}

export const getTemplateTypeLabel = (type) => {
  if (type === 'partner_a') return 'Partner A'
  if (type === 'partner_b') return 'Partner B'
  return 'Base'
}

export const PIPELINE_COLOR_CLASSES = {
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', badge: 'bg-gray-500' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', badge: 'bg-blue-500' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', badge: 'bg-green-500' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', badge: 'bg-purple-500' },
}

export const getPipelineColorClasses = (color) => {
  return PIPELINE_COLOR_CLASSES[color] || PIPELINE_COLOR_CLASSES.gray
}
