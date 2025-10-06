//src/hooks/useFetch.js
import { useEffect, useState } from 'react'

export function useFetch(promiseFactory, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)

    promiseFactory()
      .then((res) => { if (alive) setData(res) })
      .catch((err) => { if (alive) setError(err) })
      .finally(() => { if (alive) setLoading(false) })

    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload: () => promiseFactory().then(setData) }
}
