export const getBoardRoute = (appId, boardId) => {
  if (!boardId) return '/dashboard';
  switch (appId) {
    case 'sekkeiya': return `/dashboard/projects/${boardId}`;
    case 'share':    return `/app/share/boards/${boardId}`;
    case 'layout':   return `/app/layout/boards/${boardId}`;
    case 'presents': return `/app/presents/boards/${boardId}`;
    case 'create':   return `/app/create/boards/${boardId}`;
    case 'books':    return `/app/books/boards/${boardId}`;
    case 'quest':    return `/app/quest/boards/${boardId}`;
    default:         return `/dashboard/projects/${boardId}`;
  }
};
