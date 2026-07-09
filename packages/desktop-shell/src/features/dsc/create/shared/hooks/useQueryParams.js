import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export function useQueryParams() {
  const { search } = useLocation();

  return useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      from: params.get('from'),
      projectId: params.get('projectId'),
      boardId: params.get('boardId'),
      autoInsertToBoard: params.get('autoInsertToBoard') === 'true',
    };
  }, [search]);
}
