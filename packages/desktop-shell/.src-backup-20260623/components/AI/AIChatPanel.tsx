import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Button, TextField, IconButton, Select, MenuItem, CircularProgress, Tooltip, Menu } from '@mui/material';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BRAND } from '../../styles/theme';
import { launchWorkspace } from '../../features/launcher/launchWorkspace';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAiProfileStore } from '../../store/useAiProfileStore';
import { useCoreOrchestrator } from '../../store/useCoreOrchestrator';
import { useJournalAiStore } from '../../store/useJournalAiStore';
import { useJournalStore } from '../../store/useJournalStore';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useAIChatStore } from '../../store/useAIChatStore';
import ChatHistoryDialog from './ChatHistoryDialog';

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      className="copy-btn"
      size="small"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      sx={{
        position: 'absolute',
        top: 4,
        right: 4,
        opacity: copied ? 1 : 0,
        transition: 'opacity 0.2s',
        bgcolor: 'rgba(26,31,43,0.8)',
        color: copied ? '#81c995' : 'rgba(255,255,255,0.7)',
        '&:hover': { bgcolor: 'rgba(26,31,43,1)', color: copied ? '#81c995' : '#fff' }
      }}
    >
      {copied ? <CheckIcon sx={{ fontSize: '0.8rem' }} /> : <ContentCopyIcon sx={{ fontSize: '0.8rem' }} />}
    </IconButton>
  );
};

const AnimatedText = ({ text, isNew, onType }: { text: string; isNew: boolean, onType?: () => void }) => {
  const [displayedText, setDisplayedText] = useState(isNew ? '' : text);

  useEffect(() => {
    if (!isNew) {
      setDisplayedText(text);
      return;
    }
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex++;
      setDisplayedText(text.substring(0, currentIndex));
      if (onType) onType();
      if (currentIndex >= text.length) {
        clearInterval(interval);
      }
    }, 15); // Adjust typing speed here (15ms per character)
    
    return () => clearInterval(interval);
  }, [text, isNew, onType]);

  return <>{displayedText}</>;
};

const AIChatPanel: React.FC = () => {
  const [chatText, setChatText] = useState("");
  const [showDebugPrompt, setShowDebugPrompt] = useState(false);
  const [debugPromptContent, setDebugPromptContent] = useState<string>("");
  const { contextLevel, watchedScopes, setContextLevel, toggleWatchedScope } = useJournalAiStore();
  const { submitEntry, entries, updateEntry, selectedEntryId } = useJournalStore();
  const [actionAnchorEl, setActionAnchorEl] = useState<{ msgId: string, el: HTMLElement, text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);

  const { isProcessing, sendMessageToOrchestrator } = useCoreOrchestrator();
  const { activeSessionId, createSession, sessions, getSessionsForProject, setActiveSession } = useAIChatStore();

  const { getActiveProject, getActiveWorkspace, lastLaunchPayload, selectedLlmModel, setSelectedLlmModel, setAIChatOpen } = useAppStore();
  const { currentUser } = useAuthStore();
  
  const activeProfile = useAiProfileStore(s => s.aiProfiles.find(p => p.status === 'Active'));
  const buildCompleteSystemPrompt = useAiProfileStore(s => s.buildCompleteSystemPrompt);

  const activeProject = getActiveProject();
  const activeWorkspace = getActiveWorkspace();

  const allMessages = useAIChatStore(s => s.messages);
  const messages = React.useMemo(() => {
    return activeSessionId ? allMessages.filter(m => m.sessionId === activeSessionId) : [];
  }, [allMessages, activeSessionId]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView();
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!activeProject?.id) return;
    const projectSessions = getSessionsForProject(activeProject.id);
    if (projectSessions.length === 0) {
      createSession(activeProject.id);
    } else if (!activeSessionId || !projectSessions.find(s => s.id === activeSessionId)) {
      setActiveSession(projectSessions[0].id);
    }
  }, [activeProject?.id, activeSessionId, getSessionsForProject, createSession, setActiveSession]);

  useEffect(() => {
    let active = true;
    if (showDebugPrompt && activeProfile) {
      setDebugPromptContent("Loading system prompt...");
      buildCompleteSystemPrompt(activeProfile.id).then(content => {
        if (active) setDebugPromptContent(content);
      }).catch(err => {
        if (active) setDebugPromptContent("Error loading prompt.");
      });
    }
    return () => { active = false; };
  }, [showDebugPrompt, activeProfile, buildCompleteSystemPrompt, contextLevel, watchedScopes]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim() || isProcessing) return;
    const text = chatText.trim();
    setChatText("");

    const result = await sendMessageToOrchestrator(text, { source: 'sidebar_chat', sessionId: activeSessionId || undefined });
    if (result.actionType && result.actionType !== 'NONE') {
      await (await import('../../store/useActionRegistry')).useActionRegistry.getState().dispatch(result.actionType, result.payload);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1a1f2b', color: '#fff' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgba(255,255,255,0.05)`, minHeight: 48 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, overflow: 'hidden' }}>
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, letterSpacing: '0.5px', color: 'rgba(255,255,255,0.8)' }}>
            AI Chat
          </Typography>
          {activeSessionId && (
            <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              - {sessions.find(s => s.id === activeSessionId)?.title || "新規チャット"}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton 
            size="small" 
            onClick={() => activeProject?.id && createSession(activeProject.id)}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            title="New Chat"
          >
            <AddRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setHistoryOpen(true)}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
            title="History"
          >
            <HistoryRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={() => setAIChatOpen(false)}
            sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Main Chat Area */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', pb: 2 }}>
        
        {/* Context Block */}
        <Box sx={{ p: 2, flexShrink: 0, pb: 0 }}>
          <Box sx={{ 
            bgcolor: 'rgba(0,0,0,0.15)', 
            border: `1px solid rgba(255,255,255,0.05)`, 
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <Box 
              onClick={() => setIsContextExpanded(!isContextExpanded)}
              sx={{ 
                p: 1.5, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Context Settings
                </Typography>
                <Tooltip 
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, mb: 0.5 }}>コンテキスト設定</Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
                        AIにプロジェクト内のどの情報（要件、レイアウト、議事録など）を事前に共有するかを設定します。<br/><br/>
                        <b>Project:</b> プロジェクト全体の情報を加味して回答します。<br/>
                        <b>Workspace:</b> 現在開いている画面の情報のみ加味します。<br/>
                        <b>OFF:</b> 一般的な知識のみで回答します（最速）。
                      </Typography>
                    </Box>
                  }
                  placement="right"
                  arrow
                  onClick={(e) => e.stopPropagation()} // Prevent toggling accordion when clicking info icon
                >
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', cursor: 'help' }} />
                </Tooltip>
              </Box>
              {isContextExpanded ? <KeyboardArrowUpIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)' }} />}
            </Box>

            {isContextExpanded && (
              <Box sx={{ p: 1.5, pt: 0 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', mb: 1 }}>
                  Current Context
                </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>User</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{currentUser ? currentUser.email : 'Not Logged In'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Project</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{activeProject ? activeProject.name : 'None'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Workspace</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400 }}>{activeWorkspace ? activeWorkspace.name : 'None (Home view)'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', fontSize: '0.65rem', alignItems: 'center' }}>
                <Typography sx={{ color: 'rgba(255,255,255,0.5)', width: 70, fontSize: 'inherit', fontWeight: 400 }}>Status</Typography>
                <Typography component="div" sx={{ color: 'rgba(255,255,255,0.9)', flex: 1, fontSize: 'inherit', fontWeight: 400, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {activeWorkspace ? (
                    <><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#4caf50' }} /> App Runtime</>
                  ) : (
                    <><Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} /> Hub Mode</>
                  )}
                </Typography>
              </Box>
            </Box>

            {lastLaunchPayload && (
              <Box sx={{ mt: 1.5, p: 1, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.05)`, borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#4fc3f7', fontWeight: 500 }}>Scope: {lastLaunchPayload.appScope}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', wordBreak: 'break-all', mt: 0.25 }}>wsId: {lastLaunchPayload.workspaceId}</Typography>
                {!activeWorkspace && (
                  <Button 
                    variant="contained"
                    size="small" 
                    disableElevation
                    onClick={() => launchWorkspace(lastLaunchPayload)}
                    sx={{ mt: 1, width: '100%', textTransform: 'none', fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff', py: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                  >
                    Resume Workspace
                  </Button>
                )}
              </Box>
            )}

            {/* Watching Context Block */}
            <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#8ab4f8', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <MemoryIcon sx={{ fontSize: 12 }} /> Watching Context
                </Typography>
                <Select
                  value={contextLevel}
                  onChange={(e) => setContextLevel(e.target.value as any)}
                  size="small"
                  variant="standard"
                  disableUnderline
                  sx={{ 
                    fontSize: '0.6rem', 
                    color: '#8ab4f8', 
                    '& .MuiSelect-select': { py: 0, px: 0.5 },
                    '& .MuiSelect-icon': { color: '#8ab4f8', width: '0.8em', height: '0.8em' }
                  }}
                >
                  <MenuItem value="off" sx={{ fontSize: '0.65rem' }}>OFF</MenuItem>
                  <MenuItem value="workspace" sx={{ fontSize: '0.65rem' }}>Workspace</MenuItem>
                  <MenuItem value="project" sx={{ fontSize: '0.65rem' }}>Project</MenuItem>
                  <MenuItem value="custom" sx={{ fontSize: '0.65rem' }}>Custom</MenuItem>
                </Select>
              </Box>

              {contextLevel !== 'off' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pl: 0.5 }}>
                  {['requirements', 'workfiles', 'models', 'layout', 'presents', 'journal'].map(scope => {
                    const isWatched = contextLevel === 'project' || (contextLevel === 'custom' && watchedScopes.includes(scope as any));
                    const isWorkspaceAndCurrent = contextLevel === 'workspace' && scope === 'journal'; // Simple mock mapping
                    
                    const active = isWatched || isWorkspaceAndCurrent;

                    return (
                      <Box 
                        key={scope} 
                        onClick={() => contextLevel === 'custom' && toggleWatchedScope(scope as any)}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5, 
                          opacity: active ? 1 : 0.3,
                          cursor: contextLevel === 'custom' ? 'pointer' : 'default',
                          '&:hover': { opacity: contextLevel === 'custom' ? 0.8 : (active ? 1 : 0.3) }
                        }}
                      >
                        {active ? <CheckBoxIcon sx={{ fontSize: 12, color: '#8ab4f8' }} /> : <CheckBoxOutlineBlankIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />}
                        <Typography sx={{ fontSize: '0.65rem', color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                          {scope}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Injected System Context Debug View */}
            <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px solid rgba(255,255,255,0.05)` }}>
               <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#e2a6ff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <span style={{ fontSize: '9px' }}>🧠</span> Injected System Context
                  </Typography>
                  <Button 
                    size="small" 
                    variant="text" 
                    disableRipple
                    sx={{ fontSize: '0.6rem', p: 0, minWidth: 'auto', textTransform: 'none', color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
                    onClick={() => setShowDebugPrompt(!showDebugPrompt)}
                  >
                    {showDebugPrompt ? 'Hide' : 'Inspect'}
                  </Button>
               </Box>
               
               {showDebugPrompt && (
                 <Box sx={{ 
                   mt: 1,
                   bgcolor: 'rgba(0,0,0,0.3)', 
                   p: 1, 
                   borderRadius: 1.5, 
                   maxHeight: 250, 
                   overflowY: 'auto',
                   border: `1px solid rgba(226, 166, 255, 0.2)`
                 }}>
                   {activeProfile ? (
                     <>
                       {/* Context Metadata */}
                       <Box sx={{ mb: 1, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                         <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>Profile: {activeProfile.name}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', mt: 0.25, fontWeight: 400 }}>Model: {activeProfile.baseModelId}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', fontWeight: 400 }}>Role: {activeProfile.role} | Scopes: {activeProfile.usageScopes.join(', ')}</Typography>
                         <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', mt: 0.25, fontWeight: 400 }}>
                           Memory: {activeProfile.useSaveDataMemories ? <span style={{color: '#4caf50'}}>ON</span> : <span style={{color: '#f44336'}}>OFF</span>}
                         </Typography>
                       </Box>
                       
                       {/* Raw Injected Prompt */}
                       <Typography component="pre" sx={{ 
                         whiteSpace: 'pre-wrap', 
                         wordBreak: 'break-all', 
                         color: 'rgba(255,255,255,0.6)',
                         fontSize: '0.6rem',
                         lineHeight: 1.4,
                         fontFamily: 'monospace',
                         m: 0,
                         fontWeight: 400
                       }}>
                         {debugPromptContent}
                       </Typography>
                     </>
                   ) : (
                     <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
                       No active AI profile found.
                     </Typography>
                   )}
                 </Box>
               )}
            </Box>

              </Box>
            )}
          </Box>
        </Box>

        {/* Chat Messages */}
        <Box sx={{ px: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {messages.map((msg, index) => (
            <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.25, gap: 1 }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, textTransform: 'uppercase' }}>
                  {msg.role === 'user' ? 'You' : 'AI Assistant'}
                </Typography>
              </Box>
              {msg.role === 'ai' ? (
                <Box sx={{ position: 'relative', width: '100%', display: 'flex', '&:hover .copy-btn': { opacity: 1 } }}>
                  <Paper elevation={0} sx={{ 
                    p: 1.25, 
                    px: 1.5,
                    maxWidth: '90%', 
                    bgcolor: 'transparent', 
                    color: 'rgba(255,255,255,0.9)',
                    borderRadius: 2,
                    border: `1px solid rgba(255,255,255,0.05)`,
                    flexGrow: 1
                  }}>
                    <Typography sx={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 300, 
                      lineHeight: 1.5, 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                      WebkitFontSmoothing: 'antialiased'
                    }}>
                      <AnimatedText text={msg.text} isNew={index === messages.length - 1 && Date.now() - msg.timestamp < 1000} onType={scrollToBottom} />
                    </Typography>
                  </Paper>
                  <CopyButton text={msg.text} />
                </Box>
              ) : (
                <Paper elevation={0} sx={{ 
                  p: 1.25, 
                  px: 1.5,
                  maxWidth: '90%', 
                  bgcolor: 'rgba(255,255,255,0.08)', 
                  color: 'rgba(255,255,255,0.9)',
                  borderRadius: 2,
                  border: 'none'
                }}>
                  <Typography sx={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 300, 
                    lineHeight: 1.5, 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                    WebkitFontSmoothing: 'antialiased'
                  }}>
                    {msg.text}
                  </Typography>
                </Paper>
              )}
              {msg.role === 'ai' && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: '90%', mt: 0.5 }}>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<BookmarkAddOutlinedIcon sx={{ fontSize: '0.7rem' }} />}
                    sx={{
                      minWidth: 'auto', p: 0, px: 1, py: 0.25, fontSize: '0.6rem', color: '#8ab4f8', textTransform: 'none',
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'rgba(138, 180, 248, 0.1)' }
                    }}
                    onClick={(e) => setActionAnchorEl({ msgId: msg.id, el: e.currentTarget, text: msg.text })}
                  >
                    アクション
                  </Button>
                </Box>
              )}
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* Input Area */}
      <Box sx={{ p: 2, pt: 1, bgcolor: '#1a1f2b', flexShrink: 0 }}>
        <Box 
          component="form" 
          onSubmit={handleChatSubmit}
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            bgcolor: 'rgba(0,0,0,0.2)',
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 3,
            p: 0.5,
            mb: 1,
            transition: 'border-color 0.2s',
            '&:focus-within': {
              borderColor: 'rgba(255,255,255,0.3)'
            }
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={5}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="アシスタントにメッセージを送信..."
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                p: 0.5,
                px: 1,
              }
            }}
            inputProps={{
              style: {
                fontSize: '0.75rem',
                fontWeight: 300,
                color: '#fff',
                lineHeight: 1.5,
                fontFamily: '"Proxima Nova", "Kozuka Gothic Pr6N", "小塚ゴシック Pr6N", "Kozuka Gothic Pro", "小塚ゴシック Pro", "Segoe UI Light", "Helvetica Neue Light", "Yu Gothic UI Light", sans-serif',
                WebkitFontSmoothing: 'antialiased'
              }
            }}
          />
          <IconButton 
            type="submit" 
            disabled={!chatText.trim() || isProcessing}
            sx={{ 
              m: 0.5,
              bgcolor: chatText.trim() ? '#fff' : 'transparent',
              color: chatText.trim() ? '#000' : 'rgba(255,255,255,0.2)',
              borderRadius: 2,
              p: 0.75,
              transition: 'all 0.2s',
              '&:hover': { bgcolor: chatText.trim() ? '#f0f0f0' : 'transparent' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' }
            }}
          >
            {isProcessing ? <CircularProgress size={16} color="inherit" /> : <SendRoundedIcon sx={{ fontSize: '1rem' }} />}
          </IconButton>
        </Box>

        {/* Model Selector below input */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5 }}>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
            Model:
          </Typography>
          <Select
            value={selectedLlmModel}
            onChange={(e) => setSelectedLlmModel(e.target.value)}
            size="small"
            variant="outlined"
            MenuProps={{
              PaperProps: {
                sx: {
                  bgcolor: '#1a1f2b',
                  border: `1px solid rgba(255,255,255,0.1)`,
                  color: 'rgba(255,255,255,0.9)'
                }
              }
            }}
            sx={{
              height: 20,
              fontSize: '0.6rem',
              fontWeight: 300,
              color: 'rgba(255,255,255,0.6)',
              bgcolor: 'transparent',
              borderRadius: 1,
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' },
              '& .MuiSelect-select': { py: 0, px: 1, display: 'flex', alignItems: 'center' },
              '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.4)', width: '0.8em', height: '0.8em' }
            }}
          >
            <MenuItem value="gemini-1.5-flash" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Gemini 1.5 Flash (Free)</MenuItem>
            <MenuItem value="gemini-1.5-pro" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>Gemini 1.5 Pro</MenuItem>
            <MenuItem value="gpt-4o" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>GPT-4o</MenuItem>
            <MenuItem value="nanobanana" sx={{ fontSize: '0.65rem', fontWeight: 300 }}>nanobanana (Image)</MenuItem>
          </Select>
        </Box>
      </Box>
      
      <Menu
        anchorEl={actionAnchorEl?.el}
        open={Boolean(actionAnchorEl)}
        onClose={() => setActionAnchorEl(null)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1f2b',
            border: `1px solid rgba(255,255,255,0.1)`,
            color: 'rgba(255,255,255,0.9)'
          }
        }}
      >
        {selectedEntryId && (
          <MenuItem
            onClick={async () => {
              const text = actionAnchorEl?.text;
              setActionAnchorEl(null);
              if (text && selectedEntryId) {
                const targetEntry = entries.find(e => e.id === selectedEntryId);
                if (targetEntry) {
                  const newContent = text;
                  try {
                    await updateEntry(selectedEntryId, newContent);
                  } catch (err) {
                    console.error("Failed to replace journal content", err);
                  }
                }
              }
            }}
            sx={{ fontSize: '0.8rem' }}
          >
            開いている記事に置き換え
          </MenuItem>
        )}
        <MenuItem
          onClick={async () => {
            const text = actionAnchorEl?.text;
            setActionAnchorEl(null);
            if (text) {
              try {
                await submitEntry(text, "AIサマリー", {
                  contextLevel,
                  watchedScopes,
                  activeProfileId: activeProfile?.id,
                  activeProfileName: activeProfile?.name,
                  workspaceId: activeWorkspace?.workspaceId || null,
                  workspaceName: activeWorkspace?.name || null
                });
              } catch(err) {
                console.error("Failed to save to journal", err);
              }
            }
          }}
          sx={{ fontSize: '0.8rem' }}
        >
          新規ジャーナルとして保存
        </MenuItem>
      </Menu>
      <ChatHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Box>
  );
};

export default AIChatPanel;
