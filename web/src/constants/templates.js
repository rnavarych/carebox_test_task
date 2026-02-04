/**
 * Template Constants
 *
 * Centralized configuration for email templates.
 * Mirrors the test_framework configuration for consistency.
 */

/**
 * List of template files
 */
export const TEMPLATE_FILES = [
  'site_visitor_welcome.mjml',
  'site_visitor_welcome_partner_a.mjml',
  'site_visitor_welcome_partner_b.mjml',
]

/**
 * Template names (without extension)
 */
export const TEMPLATE_NAMES = TEMPLATE_FILES.map(f => f.replace('.mjml', ''))

/**
 * Base template for comparisons
 */
export const BASE_TEMPLATE = 'site_visitor_welcome'

/**
 * Template metadata
 */
export const TEMPLATE_META = {
  site_visitor_welcome: {
    name: 'Site Visitor Welcome',
    description: 'Base template - Standard welcome email with blue color scheme',
    type: 'base',
    isBase: true,
  },
  site_visitor_welcome_partner_a: {
    name: 'Partner A Welcome',
    description: 'Partner A variation - Same content, green color scheme',
    type: 'partner_a',
    isBase: false,
    expectedDifference: 'styling',
    baseTemplate: 'site_visitor_welcome',
  },
  site_visitor_welcome_partner_b: {
    name: 'Partner B Welcome',
    description: 'Partner B variation - Same colors, different content',
    type: 'partner_b',
    isBase: false,
    expectedDifference: 'content',
    baseTemplate: 'site_visitor_welcome',
  },
}

/**
 * Template comparisons
 */
export const TEMPLATE_COMPARISONS = [
  {
    id: 'partner_a_vs_base',
    name: 'Partner A vs Base',
    base: 'site_visitor_welcome',
    compare: 'site_visitor_welcome_partner_a',
    expectedDifference: 'styling',
    description: 'Partner A should have different colors but same content',
  },
  {
    id: 'partner_b_vs_base',
    name: 'Partner B vs Base',
    base: 'site_visitor_welcome',
    compare: 'site_visitor_welcome_partner_b',
    expectedDifference: 'content',
    description: 'Partner B should have same colors but different content',
  },
]

/**
 * Get template metadata by name
 */
export function getTemplateMeta(templateName) {
  return TEMPLATE_META[templateName] || {
    name: templateName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: '',
    type: 'unknown',
  }
}

/**
 * Get comparison config for a template
 */
export function getComparisonConfig(templateName) {
  return TEMPLATE_COMPARISONS.find(c => c.compare === templateName)
}
