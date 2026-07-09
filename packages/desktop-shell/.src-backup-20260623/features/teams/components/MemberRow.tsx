import React, { useState, useEffect } from 'react';
import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { BRAND } from '../../../styles/theme';

interface MemberRowProps {
  uid: string;
  isOwner: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

export const MemberRow: React.FC<MemberRowProps> = ({ uid, isOwner, canRemove, onRemove }) => {
  const [profile, setProfile] = useState<{ displayName: string; photoURL: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(s => {
      if (s.exists()) {
        const d = s.data();
        setProfile({ displayName: d.displayName || 'ユーザー', photoURL: d.photoURL || '' });
      }
    });
  }, [uid]);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
      borderBottom: `1px solid ${BRAND.line}`,
      '&:last-child': { borderBottom: 'none' },
    }}>
      <Avatar src={profile?.photoURL} sx={{ width: 38, height: 38, bgcolor: '#3498db', fontSize: 14 }}>
        {profile?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>
          {profile?.displayName ?? uid.slice(0, 8) + '...'}
        </Typography>
        {isOwner && (
          <Typography sx={{ fontSize: 11, color: '#3498db' }}>オーナー</Typography>
        )}
      </Box>
      {canRemove && (
        <Tooltip title="削除">
          <IconButton size="small" onClick={onRemove} sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};
