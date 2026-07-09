import { useState, useEffect } from 'react';
import { fetchPresentations } from '../../../shared/api/presentsApi';

export function usePresentations(projectId) {
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!projectId) {
        if (isMounted) {
          setPresentations([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchPresentations(projectId);
        if (isMounted) {
          setPresentations(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch presentations:', err);
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  return { presentations, loading, error };
}
