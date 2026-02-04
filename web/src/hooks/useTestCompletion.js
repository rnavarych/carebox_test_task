import { useState, useEffect, useRef, useCallback } from 'react'
import { API_ENDPOINTS } from '../constants'

/**
 * Hook to detect when tests complete and trigger a callback
 * Polls the test status endpoint and calls onComplete when tests finish
 */
export function useTestCompletion(onComplete, pollingInterval = 2000) {
  const [isTestRunning, setIsTestRunning] = useState(false)
  const wasRunningRef = useRef(false)
  const intervalRef = useRef(null)

  const checkTestStatus = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.TEST_STATUS)
      if (res.ok) {
        const data = await res.json()
        const currentlyRunning = data.isRunning || false

        // Detect transition from running to not running (test completed)
        if (wasRunningRef.current && !currentlyRunning) {
          // Tests just finished - call the callback
          if (onComplete) {
            onComplete()
          }
        }

        wasRunningRef.current = currentlyRunning
        setIsTestRunning(currentlyRunning)
      }
    } catch (err) {
      console.error('Failed to check test status:', err)
    }
  }, [onComplete])

  useEffect(() => {
    // Initial check
    checkTestStatus()

    // Set up polling
    intervalRef.current = setInterval(checkTestStatus, pollingInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkTestStatus, pollingInterval])

  return { isTestRunning }
}

export default useTestCompletion
