export const getBoardRoute = (appId, projectId, boardId) => {
  // If we don't have enough to route, fallback
  if (!boardId && !projectId) return '/dashboard';
  
  // Construct query string
  let queryParams = [];
  if (projectId) queryParams.push(`projectId=${projectId}`);
  if (boardId) queryParams.push(`boardId=${boardId}`);
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

  switch (appId) {
    case 'sekkeiya': return `/dashboard/projects${query}`;
    case 'share':    return `/app/share${query}`;
    case 'layout':   return `/app/layout${query}`;
    case 'presents': return `/app/presents${query}`;
    case 'create':   return `/app/create${query}`;
    case 'books':    return `/app/books${query}`;
    case 'quest':    return `/app/quest${query}`;
    default:         return `/dashboard/projects${query}`;
  }
};
