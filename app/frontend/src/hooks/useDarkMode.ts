import { useEffect } from 'react'

export function useDarkMode(): [boolean, () => void] {
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const noop = () => {}
  return [true, noop]
}
