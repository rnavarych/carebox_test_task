/**
 * File Pattern Constants
 *
 * Patterns for linking related files (test plans, logs, reports).
 * These files share timestamps to enable cascading operations.
 */

/**
 * File name patterns
 */
export const FILE_PATTERNS = {
  // Pattern generators
  testPlan: (timestamp) => `test-plan-${timestamp}.json`,
  logFile: (timestamp) => `test-${timestamp}.log`,
  reportFile: (timestamp) => `report-${timestamp}.html`,

  // Regex patterns for extracting timestamps
  testPlanRegex: /test-plan-(.+)\.json$/,
  logFileRegex: /test-(.+)\.log$/,
  reportFileRegex: /report-(.+)\.html$/,
}

/**
 * Extract timestamp from a filename
 * @param {string} filename - The filename to extract from
 * @param {'testPlan' | 'log' | 'report'} type - The type of file
 * @returns {string | null} The extracted timestamp or null
 */
export function extractTimestamp(filename, type) {
  const patterns = {
    testPlan: FILE_PATTERNS.testPlanRegex,
    log: FILE_PATTERNS.logFileRegex,
    report: FILE_PATTERNS.reportFileRegex,
  }

  const match = filename.match(patterns[type])
  return match ? match[1] : null
}

/**
 * Get all linked file names for a given timestamp
 * @param {string} timestamp - The timestamp to use
 * @returns {{ testPlan: string, log: string, report: string }}
 */
export function getLinkedFiles(timestamp) {
  return {
    testPlan: FILE_PATTERNS.testPlan(timestamp),
    log: FILE_PATTERNS.logFile(timestamp),
    report: FILE_PATTERNS.reportFile(timestamp),
  }
}

/**
 * Extract timestamp from test plan ID
 * @param {string} testPlanId - The test plan ID (e.g., "test-plan-2024-01-15T10-30-00-000Z")
 * @returns {string | null}
 */
export function extractTimestampFromTestPlanId(testPlanId) {
  const match = testPlanId.match(/test-plan-(.+)/)
  return match ? match[1] : null
}

/**
 * Extract timestamp from log file name
 * @param {string} logFile - The log file name (e.g., "test-2024-01-15T10-30-00-000Z.log")
 * @returns {string | null}
 */
export function extractTimestampFromLogFile(logFile) {
  const match = logFile.match(/test-(.+)\.log/)
  return match ? match[1] : null
}

/**
 * Extract timestamp from report file name
 * @param {string} reportFile - The report file name (e.g., "report-2024-01-15T10-30-00-000Z.html")
 * @returns {string | null}
 */
export function extractTimestampFromReportFile(reportFile) {
  const match = reportFile.match(/report-(.+)\.html/)
  return match ? match[1] : null
}

/**
 * Find related report ID from test plan ID
 * @param {string} testPlanId
 * @returns {string | null}
 */
export function getRelatedReportId(testPlanId) {
  const timestamp = extractTimestampFromTestPlanId(testPlanId)
  return timestamp ? `report-${timestamp}` : null
}

/**
 * Find related log file from test plan ID
 * @param {string} testPlanId
 * @returns {string | null}
 */
export function getRelatedLogFile(testPlanId) {
  const timestamp = extractTimestampFromTestPlanId(testPlanId)
  return timestamp ? `test-${timestamp}.log` : null
}
