export type AppId = "share" | "layout" | "create" | "books" | "presents" | "sekkeiya" | "quest";

export type Board = {
  id: string;
  name: string;
  boardType?: string;
  coverThumbnailUrl?: string;
  orderIndex?: number;
  createdAt?: string | number | Date;
  [key: string]: any;
};

export type User = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  [key: string]: any;
};

export type MiniSidebarProps = {
  currentApp: AppId;
  currentBoardId?: string;
  boards: Board[];
  user?: User | null;
  onNavigate: (path: string) => void;
  onNavigateExternal: (url: string) => void;
  onOpenChat: () => void;
  onOpenDrive: () => void;
  onLogout: () => void;
  onToggle?: () => void;
  isExpanded?: boolean;
  recentApps?: AppId[];
  appIcons?: Record<AppId, string>;
};

export type GlobalUIState = {
  currentApp: string;
  currentBoardId?: string;
  currentChatId?: string;
  sidebarOpen: boolean;
  panelState: "chat" | "drive" | null;
  recentApps: string[];
};
