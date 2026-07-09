import React from 'react';
import { ResearchBoardWorkspace } from './ResearchBoardWorkspace';
import { AccountMemoTab } from './AccountMemoTab';
import { ACCOUNT_BOARD_ID } from '../../features/projects/repositories/ResearchCanvasRepository';

/**
 * アカウントサイトの Research & Memo タブ。
 * プロジェクト版と同一仕様（複数ボード対応）で、スコープ='account' の個人ボード群。
 * 用途 =「そのユーザーの目指す方向性・やりたいこと」を AI と一緒にロジック化する場。
 * 右サイドバー = 従来の横断メモ一覧（AccountMemoTab）。
 */
export const AccountResearchMemoTab: React.FC = () => (
  <ResearchBoardWorkspace scope={ACCOUNT_BOARD_ID} sidebar={<AccountMemoTab />} sidebarWidth={420} />
);

export default AccountResearchMemoTab;
