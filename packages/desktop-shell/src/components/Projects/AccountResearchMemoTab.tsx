import React from 'react';
import { ResearchBoardWorkspace } from './ResearchBoardWorkspace';
import { AccountMemoTab } from './AccountMemoTab';
import { ResearchDetachedNotice } from './ResearchDetachedNotice';
import { ACCOUNT_BOARD_ID } from '../../features/projects/repositories/ResearchCanvasRepository';
import { useResearchWindowState } from '../../features/projects/chat/researchWindowPresence';
import { resolveResearchTabView } from '../../features/projects/research/researchScope';

/**
 * アカウントサイトの Research & Memo タブ。
 * プロジェクト版と同一仕様（複数ボード対応）で、スコープ='account' の個人ボード群。
 * 用途 =「そのユーザーの目指す方向性・やりたいこと」を AI と一緒にロジック化する場。
 * 右サイドバー = 従来の横断メモ一覧（AccountMemoTab）。
 * 独立ウィンドウが開いている間はワークスペースをマウントしない（デタッチ方式）。
 */
export const AccountResearchMemoTab: React.FC = () => {
  const windowState = useResearchWindowState();
  const tabView = resolveResearchTabView(windowState);
  if (tabView === 'detached') return <ResearchDetachedNotice />;
  // 'pending'（開閉確認前）はワークスペースを一瞬たりともマウントしない。
  // 「常に1インスタンスのみ」の不変条件を守るため、確定するまでは何も描画しない。
  if (tabView === 'pending') return null;
  return (
    <ResearchBoardWorkspace
      scope={ACCOUNT_BOARD_ID}
      sidebar={<AccountMemoTab />}
      sidebarWidth={420}
      showPopOut
    />
  );
};

export default AccountResearchMemoTab;
