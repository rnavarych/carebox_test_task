export const PIPELINE_STEPS = [
  { id: 'init', name: 'Initializing', icon: '🚀', color: 'gray', bgColor: 'bg-gray-500', description: 'Setting up test environment' },
  { id: 'planner', name: 'Test Planner', icon: '📋', color: 'blue', bgColor: 'bg-blue-500', description: 'Analyzing requirements and creating test plans' },
  { id: 'analyzer', name: 'Change Analyzer', icon: '🔍', color: 'green', bgColor: 'bg-green-500', description: 'Detecting file changes and modified templates' },
  { id: 'diff', name: 'Diff Analyzer', icon: '⚖️', color: 'yellow', bgColor: 'bg-yellow-500', description: 'Comparing templates and analyzing differences' },
  { id: 'reporter', name: 'Report Generator', icon: '📝', color: 'purple', bgColor: 'bg-purple-500', description: 'Creating comprehensive test report' },
  { id: 'complete', name: 'Complete', icon: '✅', color: 'green', bgColor: 'bg-green-600', description: 'All tests completed successfully' },
  { id: 'error', name: 'Error', icon: '❌', color: 'red', bgColor: 'bg-red-600', description: 'Test failed' },
]

export const getProgressSteps = () => PIPELINE_STEPS.filter(s => !['complete', 'error'].includes(s.id))
