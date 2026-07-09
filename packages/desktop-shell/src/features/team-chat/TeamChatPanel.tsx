// プロジェクトメンバー間チャット（Project Chat）。
// SEKKEIYA Chat（AIChatPanel）と同じ右サイドパネル形式・同じデザイン言語で表示する。
// - トーク選択（LINE 風）: 未選択時はパネル内に選択画面、ヘッダーのボタンでサイドバー開閉。
// - 会話種別: プロジェクト / チーム / ダイレクト（useTeamChatStore.target）。
// - プロジェクト会話では「@AI 〜」や候補ピルでオーケストレーターを呼び出し、
//   会話の流れから予定・タスクを自動登録 → AI の返答を参加者としてチャットに投稿する。

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, TextField, IconButton, Avatar, Tooltip,
  CircularProgress, AvatarGroup, Paper,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';

import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAIChatStore } from '../../store/useAIChatStore';
import { useCoreOrchestrator } from '../../store/useCoreOrchestrator';
import { useTeamChatStore, type ChatTarget } from './store/useTeamChatStore';
import { ChatTargetList } from './TeamChatNavigator';
import { decideAiTrigger, stripAiMention } from './aiTrigger';
import ProjectMembersDialog from './ProjectMembersDialog';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import {
  subscribeToConversation,
  sendConversationMessage,
  sendAiConversationMessage,
  fetchMemberProfiles,
  type TeamChatMessage,
  type MemberProfile,
} from './api/teamChatApi';

const AI_MENTION_RE = /^[@＠]\s*(AI|ai|Ai)\b[、,:：\s]*/;

// AIChatPanel と同じフォント（デザイン統一）
const FONT_FAMILY = '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif';

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatDateDivider = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日（${['日','月','火','水','木','金','土'][d.getDay()]}）`;
};

const dayKey = (iso: string): string => iso.slice(0, 10);

// 候補ピル（AIChatPanel の「候補」と同じ ＃ffd740 スタイル）。プロジェクト会話のみ。
const QUICK_ACTIONS = [
  {
    label: '会話から予定・タスク化',
    instruction: 'この会話の流れから、決まった予定（打合せ・締切・提出など）と発生したタスクを抽出して、このプロジェクトのスケジュール・タスクに登録してください。担当者が会話から明確な場合はそのメンバーに割り当ててください。',
  },
  {
    label: '会話を要約',
    instruction: 'この会話の要点（決定事項・未決事項・次のアクション）を簡潔に要約してください。登録は不要です。',
  },
];

export const TeamChatPanel: React.FC<{ embedded?: boolean; forcedTarget?: ChatTarget }> = ({ embedded = false, forcedTarget }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const setTeamChatOpen = useAppStore(s => s.setTeamChatOpen);
  const isTeamChatSidebarOpen = useAppStore(s => s.isTeamChatSidebarOpen);
  const toggleTeamChatSidebar = useAppStore(s => s.toggleTeamChatSidebar);
  const isProcessing = useCoreOrchestrator(s => s.isProcessing);
  const currentToolLabel = useCoreOrchestrator(s => s.currentToolLabel);

  const storeTarget = useTeamChatStore(s => s.target);
  // forcedTarget が指定された場合（コックピットの Chat タブでチームPの共同会話を固定表示）は
  // 共有ストアの target ではなくそれを使う（DM タブの target と干渉させない）。
  const target = forcedTarget ?? storeTarget;
  const setTarget = useTeamChatStore(s => s.setTarget);

  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [input, setInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 「AIが回答しますか？」サジェスト対象の発言（複数人チャットで依頼っぽい時に提示）。
  const [pendingAiSuggest, setPendingAiSuggest] = useState<string | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  // チームチャット連携専用の AI セッション（確認UIはサイドバーの SEKKEIYA Chat に出る）
  const aiSessionRef = useRef<string | null>(null);

  const myName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'ユーザー';
  const isProjectChat = target?.kind === 'project';

  // ── メッセージ購読 ──
  useEffect(() => {
    if (!target) { setMessages([]); return; }
    setMessages([]);
    setError(null);
    aiSessionRef.current = null;
    const unsub = subscribeToConversation(
      target,
      msgs => setMessages(msgs),
      err => {
        console.error('[team-chat]', err);
        setError('チャットの読み込みに失敗しました（権限設定をご確認ください）');
      },
    );
    return unsub;
    // topicId（プロジェクトの複数トピック）が変わったら購読を貼り直す。
  }, [target?.kind, target?.id, target?.kind === 'project' ? target.topicId : undefined]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── メンバープロフィール取得（ヘッダーのアバター表示用） ──
  useEffect(() => {
    if (!target) { setMembers([]); return; }
    if (target.kind === 'project') {
      const project = useAppStore.getState().projects.find(p => p.id === target.id);
      const uids = Array.from(new Set([project?.ownerId, ...(project?.memberIds ?? [])].filter(Boolean))) as string[];
      fetchMemberProfiles(uids).then(setMembers).catch(() => {});
    } else if (target.kind === 'team') {
      fetchMemberProfiles(target.memberIds).then(setMembers).catch(() => {});
    } else {
      setMembers([]);
    }
  }, [target?.kind, target?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 新着で最下部へスクロール ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── AI 呼び出し（プロジェクト会話のみ。会話文脈 + 指示 → 返答をチャットへ投稿）──
  const runAi = useCallback(async (instruction: string) => {
    if (aiBusy || !target || target.kind !== 'project') return;
    setAiBusy(true);
    try {
      const recent = messages.filter(m => m.kind !== 'system').slice(-30);
      const transcript = recent
        .map(m => `${m.kind === 'ai' ? 'SEKKEIYA AI' : m.senderName}: ${m.text}`)
        .join('\n');
      const memberList = members.map(m => `- ${m.displayName} (uid: ${m.uid})`).join('\n');

      const prompt = [
        `以下はプロジェクト「${target.name}」（projectId: ${target.id}）のメンバー間チャットの会話ログです。`,
        '',
        '[プロジェクトメンバー]',
        memberList || '(取得できませんでした)',
        '',
        '[会話ログ]',
        transcript || '(まだ会話はありません)',
        '',
        `[依頼者] ${myName}`,
        `[依頼内容] ${instruction}`,
        '',
        '予定・タスクを登録する場合はこのプロジェクトに登録してください。',
        'タスクを特定のメンバー宛に作成する場合は assigneeUid / assigneeName を指定してください。',
        '最後に、チームメンバー全員へ向けた簡潔な日本語の報告文で締めてください。',
      ].join('\n');

      const aiChat = useAIChatStore.getState();
      if (!aiSessionRef.current) {
        aiSessionRef.current = aiChat.createSession(target.id, `チームチャット連携（${target.name}）`);
      }

      const res = await useCoreOrchestrator.getState().sendMessageToOrchestrator(prompt, {
        source: 'sidebar_chat',
        sessionId: aiSessionRef.current,
      });

      if (res?.assistantMessage) {
        await sendAiConversationMessage(target, res.assistantMessage, myName);
      } else {
        // propose_choices 等で中断 → サイドバーの SEKKEIYA Chat で続行してもらう
        useAppStore.getState().setAIChatOpen(true);
        await sendConversationMessage(target, {
          senderUid: 'system',
          senderName: 'system',
          kind: 'system',
          text: `AIが${myName}さんに確認を求めています（SEKKEIYA OS パネルで選択すると続行されます）`,
        });
      }
    } catch (e: any) {
      console.error('[team-chat] AI request failed:', e);
      if (target) {
        await sendConversationMessage(target, {
          senderUid: 'system',
          senderName: 'system',
          kind: 'system',
          text: `AI依頼が失敗しました: ${e?.message ?? 'unknown error'}`,
        }).catch(() => {});
      }
    } finally {
      setAiBusy(false);
    }
  }, [aiBusy, messages, members, target, myName]);

  // ── 送信 ──
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !currentUser || !target) return;
    setInput('');
    try {
      await sendConversationMessage(target, {
        senderUid: currentUser.uid,
        senderName: myName,
        senderPhotoURL: currentUser.photoURL ?? '',
        kind: 'user',
        text,
      });
    } catch (e: any) {
      console.error('[team-chat] send failed:', e);
      setError('メッセージの送信に失敗しました');
      return;
    }
    // AI 応答トリガー（プロジェクト会話のみ）。人数で自動切替：
    //   1人＝常に応答 / 複数＝@AI 召喚時のみ / 依頼っぽい発言＝「AIが回答しますか？」を提示。
    if (isProjectChat) {
      // メンバー未取得(0)のときは安全側で多人数扱い（勝手に応答しない）。
      const humanCount = members.length || 2;
      const mode = decideAiTrigger(text, humanCount);
      if (mode === 'always' || mode === 'mention') {
        setPendingAiSuggest(null);
        const instruction = mode === 'mention'
          ? (stripAiMention(text) || 'この会話の流れを踏まえて、必要な予定・タスクを整理して登録してください。')
          : text;
        void runAi(instruction);
      } else if (mode === 'suggest') {
        // 依頼っぽいが @AI 明示が無い → ワンクッション置いて確認チップを出す。
        setPendingAiSuggest(text);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const aiRunning = isProjectChat && (aiBusy || isProcessing);
  const hasConversation = messages.some(m => m.kind !== 'system');

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', position: 'relative' }}>

      {/* Header（AIChatPanel と同形式）。コックピット埋め込み時はヘッダーを簡素化し、
          会話を開いているときだけ「戻る・相手名・メンバー」を出す細いコンテキストバーにする。 */}
      {(!embedded || !!target) && (
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgb(var(--brand-fg-rgb) / 0.05)`, minHeight: 48 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden' }}>
          {!embedded && (
            <IconButton
              size="small"
              onClick={toggleTeamChatSidebar}
              sx={{ color: isTeamChatSidebarOpen ? 'light-dark(#ad8900, #ffd740)' : 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25, flexShrink: 0, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
              title="トーク一覧サイドバー"
            >
              <ViewSidebarRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          )}
          {target && !forcedTarget && (
            <IconButton
              size="small"
              onClick={() => setTarget(null)}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25, flexShrink: 0, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
              title="トーク選択に戻る"
            >
              <ArrowBackRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          )}
          {!embedded && (
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.5px', color: 'rgb(var(--brand-fg-rgb) / 0.8)', flexShrink: 0 }}>
              Project Chat
            </Typography>
          )}
          {target && (
            <Typography sx={{
              fontSize: '0.7rem', color: 'light-dark(#0a45a4, #8ab4f8)', fontWeight: 600,
              bgcolor: 'rgba(138,180,248,0.1)', border: '1px solid rgba(138,180,248,0.2)',
              borderRadius: 1, px: 0.75, py: 0.15, flexShrink: 0,
              maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {target.name}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {target && (target.kind === 'dm' ? (
            <Avatar src={target.photoURL || undefined} sx={{ width: 20, height: 20, fontSize: 10, bgcolor: '#3498db' }}>
              {target.name.slice(0, 1)}
            </Avatar>
          ) : (
            <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 20, height: 20, fontSize: 10, border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)' } }}>
              {members.map(m => (
                <Tooltip key={m.uid} title={m.displayName}>
                  <Avatar src={m.photoURL || undefined} sx={{ bgcolor: '#3498db' }}>
                    {m.displayName.slice(0, 1)}
                  </Avatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          ))}
          {target?.kind === 'project' && (
            <Tooltip title="メンバーを追加">
              <IconButton
                size="small"
                onClick={() => setMembersDialogOpen(true)}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25, '&:hover': { color: 'light-dark(#0a45a4, #8ab4f8)', bgcolor: 'rgba(138,180,248,0.08)' } }}
              >
                <PersonAddAltRoundedIcon sx={{ fontSize: '1.05rem' }} />
              </IconButton>
            </Tooltip>
          )}
          {!embedded && (
            <IconButton
              size="small"
              onClick={() => setTeamChatOpen(false)}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}
            >
              <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
            </IconButton>
          )}
        </Box>
      </Box>
      )}

      {/* メンバー追加ダイアログ（プロジェクト会話のみ） */}
      {target?.kind === 'project' && (
        <ProjectMembersDialog
          open={membersDialogOpen}
          onClose={() => setMembersDialogOpen(false)}
          projectId={target.id}
          projectName={target.name}
        />
      )}

      {/* ── 未選択 ── 埋め込み時は左のトーク一覧があるのでピッカーを重複表示せず、空状態を出す。 */}
      {!target ? (
        embedded ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3, gap: 1 }}>
            <ForumRoundedIcon sx={{ fontSize: 34, color: 'rgb(var(--brand-fg-rgb) / 0.22)' }} />
            <Typography sx={{ fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.65)', fontWeight: 500 }}>
              相手を選択してください
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 300, lineHeight: 1.6 }}>
              左の一覧から相手を選ぶと<br />ダイレクトメッセージが開きます
            </Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ px: 2, pt: 1.5, fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 300 }}>
              誰とチャットしますか？
            </Typography>
            <ChatTargetList />
          </Box>
        )
      ) : (
        <>
          {/* Main Chat Area */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', pb: 2 }}>
            <Box sx={{ px: 2, pt: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>

              {messages.length === 0 && !error && (
                <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.6, py: 6 }}>
                  <ForumRoundedIcon sx={{ fontSize: 32, color: 'rgb(var(--brand-fg-rgb) / 0.3)', mb: 1 }} />
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontWeight: 300 }}>
                    {target.kind === 'dm' ? `${target.name}さんとのチャットを始めましょう` : 'メンバーとのチャットを始めましょう'}
                  </Typography>
                  {isProjectChat && (
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.5, fontWeight: 300 }}>
                      「@AI 来週月曜に定例を入れて」のように依頼すると<br />会話の流れから予定・タスクを自動登録できます
                    </Typography>
                  )}
                </Box>
              )}

              {error && (
                <Typography sx={{ m: 'auto', fontSize: '0.7rem', color: 'light-dark(#a50808, #f87171)', fontWeight: 300 }}>{error}</Typography>
              )}

              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const showDate = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                const own = m.senderUid === currentUser?.uid;
                const isAi = m.kind === 'ai';
                const isSystem = m.kind === 'system';

                return (
                  <React.Fragment key={m.id}>
                    {showDate && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 0.5 }}>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />
                        <Typography sx={{ fontSize: '0.58rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 500 }}>
                          {formatDateDivider(m.createdAt)}
                        </Typography>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />
                      </Box>
                    )}

                    {isSystem ? (
                      <Typography sx={{
                        alignSelf: 'center', textAlign: 'center', maxWidth: '90%',
                        fontSize: '0.62rem', fontWeight: 300, color: 'rgb(var(--brand-fg-rgb) / 0.4)',
                        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', px: 1.5, py: 0.5, borderRadius: 2,
                      }}>
                        {m.text}
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: own ? 'flex-end' : 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.25, gap: 1 }}>
                          <Typography sx={{ fontSize: '0.6rem', color: isAi ? 'light-dark(#0a45a4, #8ab4f8)' : 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 500, textTransform: own ? 'uppercase' : 'none' }}>
                            {own ? 'You' : m.senderName}
                            {isAi && m.requestedByName && (
                              <Box component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 400 }}>
                                {'　'}（{m.requestedByName}さんの依頼）
                              </Box>
                            )}
                          </Typography>
                          <Typography sx={{ fontSize: '0.55rem', color: 'rgb(var(--brand-fg-rgb) / 0.25)' }}>
                            {formatTime(m.createdAt)}
                          </Typography>
                        </Box>
                        <Paper elevation={0} sx={{
                          p: 1.25,
                          px: 1.5,
                          maxWidth: '90%',
                          bgcolor: own ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
                          color: 'rgb(var(--brand-fg-rgb) / 0.9)',
                          borderRadius: 2,
                          border: own ? 'none' : `1px solid ${isAi ? 'rgba(138,180,248,0.25)' : 'rgb(var(--brand-fg-rgb) / 0.05)'}`,
                        }}>
                          <Typography sx={{
                            fontSize: '0.75rem',
                            fontWeight: 300,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontFamily: FONT_FAMILY,
                            WebkitFontSmoothing: 'antialiased',
                          }}>
                            {m.text}
                          </Typography>
                        </Paper>
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </Box>

            {/* AI 実行中の進捗インジケーター（AIChatPanel と同形式） */}
            {aiRunning && (
              <Box sx={{ px: 2, pb: 1, pt: 1, flexShrink: 0 }}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  bgcolor: 'rgba(138,180,248,0.06)', border: '1px solid rgba(138,180,248,0.15)',
                  borderRadius: 2, px: 1.5, py: 0.75,
                }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: '0.75rem', color: 'light-dark(#0a45a4, #8ab4f8)', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.65rem', color: 'light-dark(rgba(10,69,164,0.9), rgba(138,180,248,0.9))', fontWeight: 300, flex: 1 }}>
                    {currentToolLabel || 'AI が考えています...'}
                  </Typography>
                  <CircularProgress size={10} sx={{ color: 'light-dark(#0a45a4, #8ab4f8)', flexShrink: 0 }} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Input Area（AIChatPanel と同形式） */}
          <Box sx={{ p: 2, pt: 1, bgcolor: 'var(--brand-surface2)', flexShrink: 0 }}>
            {/* 「AIが回答しますか？」サジェスト（複数人＋依頼っぽい発言で提示） */}
            {isProjectChat && pendingAiSuggest && !aiRunning && (
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 1,
                bgcolor: 'rgba(138,180,248,0.08)', border: '1px solid rgba(138,180,248,0.25)',
                borderRadius: 2, px: 1.25, py: 0.75,
              }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: '0.85rem', color: 'light-dark(#0a45a4, #8ab4f8)', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)', flex: 1, fontWeight: 300 }}>
                  AIが回答しますか？
                </Typography>
                <Box
                  onClick={() => { const t = pendingAiSuggest; setPendingAiSuggest(null); if (t) void runAi(t); }}
                  sx={{
                    fontSize: '0.65rem', fontWeight: 500, color: 'light-dark(#0a45a4, #8ab4f8)', cursor: 'pointer',
                    bgcolor: 'rgba(138,180,248,0.12)', border: '1px solid rgba(138,180,248,0.35)',
                    borderRadius: 5, px: 1, py: 0.3, '&:hover': { bgcolor: 'rgba(138,180,248,0.2)', color: 'var(--brand-fg)' },
                  }}
                >
                  回答してもらう
                </Box>
                <IconButton size="small" onClick={() => setPendingAiSuggest(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', p: 0.25, '&:hover': { color: 'var(--brand-fg)' } }}>
                  <CloseRoundedIcon sx={{ fontSize: '0.9rem' }} />
                </IconButton>
              </Box>
            )}
            {/* AI 候補ピル（プロジェクト会話のみ） */}
            {isProjectChat && !aiRunning && !input.trim() && hasConversation && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                <Typography sx={{ width: '100%', fontSize: '0.55rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', letterSpacing: '1px', textTransform: 'uppercase', mb: 0.25 }}>
                  候補
                </Typography>
                {QUICK_ACTIONS.map((a) => (
                  <Box
                    key={a.label}
                    onClick={() => {
                      void sendConversationMessage(target, {
                        senderUid: 'system', senderName: 'system', kind: 'system',
                        text: `${myName}さんがAIに依頼しました: ${a.label}`,
                      }).catch(() => {});
                      void runAi(a.instruction);
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.8)',
                      bgcolor: 'rgba(255,215,64,0.06)', border: '1px solid rgba(255,215,64,0.25)',
                      borderRadius: 5, px: 1, py: 0.4, cursor: 'pointer', transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'rgba(255,215,64,0.14)', color: 'var(--brand-fg)', borderColor: 'rgba(255,215,64,0.5)' },
                    }}
                    title={a.instruction}
                  >
                    <AutoAwesomeRoundedIcon sx={{ fontSize: '0.7rem', color: 'light-dark(#ad8900, #ffd740)' }} />
                    {a.label}
                  </Box>
                ))}
              </Box>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))',
                border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`,
                borderRadius: 3,
                p: 1,
                transition: 'border-color 0.2s',
                '&:focus-within': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
              }}
            >
              {/* テキスト入力 */}
              <TextField
                fullWidth
                multiline
                maxRows={6}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isProjectChat ? 'メンバーへメッセージ（@AI で依頼）' : 'メッセージを入力'}
                variant="standard"
                InputProps={{ disableUnderline: true, sx: { p: 0.5, px: 1 } }}
                inputProps={{
                  style: {
                    fontSize: '0.75rem',
                    fontWeight: 300,
                    color: 'var(--brand-fg)',
                    lineHeight: 1.5,
                    fontFamily: FONT_FAMILY,
                    WebkitFontSmoothing: 'antialiased',
                  },
                }}
              />

              {/* ボトムツールバー: @AI ヒント / 送信 */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5, px: 0.25 }}>
                {isProjectChat && input.trim().match(AI_MENTION_RE) ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: '0.7rem', color: 'light-dark(#0a45a4, #8ab4f8)' }} />
                    <Typography sx={{ fontSize: '0.6rem', color: 'light-dark(#0a45a4, #8ab4f8)', fontWeight: 300 }}>
                      送信するとAIが会話の流れを読んで対応します
                    </Typography>
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 300 }}>
                    {target.kind === 'dm'
                      ? `${target.name} さんとのダイレクトチャット`
                      : members.length > 0 ? `${members.length} メンバー${isProjectChat ? ' + AI' : ''}` : ''}
                  </Typography>
                )}

                <IconButton
                  type="submit"
                  disabled={!input.trim()}
                  sx={{
                    width: 30, height: 30, p: 0, borderRadius: '50%', transition: 'all 0.2s',
                    bgcolor: input.trim() ? '#fff' : 'rgb(var(--brand-fg-rgb) / 0.12)',
                    color: input.trim() ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                    '&:hover': { bgcolor: input.trim() ? '#f0f0f0' : 'rgb(var(--brand-fg-rgb) / 0.12)' },
                    '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' },
                  }}
                >
                  <ArrowUpwardRoundedIcon sx={{ fontSize: '1.1rem' }} />
                </IconButton>
              </Box>
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};
