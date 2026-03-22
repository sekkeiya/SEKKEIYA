export function getBoardRoute(app, boardId) {
  if (!boardId) return '/dashboard';
  switch (app) {
    case 'sekkeiya': return `/dashboard/projects/${boardId}`;
    case 'share':    return `/app/share/dashboard/models/${boardId}`;
    case 'layout':   return `/app/layout/dashboard/${boardId}`;
    case 'create':   return `/app/create/dashboard/${boardId}`;
    case 'presents': return `/app/presents/dashboard/slides/${boardId}`;
    case 'books':    return `/app/books/dashboard/stories/${boardId}`;
    case 'quest':    return `/app/quest/dashboard/quests/${boardId}`;
    default:         return `/dashboard/projects/${boardId}`;
  }
}
