import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { DslLayoutCard } from './DslLayoutCard';

export interface TreeSection {
  key: string;
  // パンくず（例: ["Layout 1"] や ["Layout 1", "Plan 2"]）。Base→Plan の所属を示す。
  breadcrumb?: string[];
  items: any[];
  emptyHint?: string;
}

export interface ProjectGroup {
  projectId: string;
  projectName: string;
  sections: TreeSection[];
}

interface DslLayoutTreeProps {
  groups: ProjectGroup[];
  cardSize?: number;
  selectedItemId?: string | null;
  onSelectLayout?: (item: any) => void;
  onDoubleClick?: (item: any) => void;
  isInitializing?: boolean;
  emptyMessage?: string;
}

// どのプロジェクトの・どの Base / Plan / Option かが分かるよう、
// プロジェクト名を最上位の見出し（＋下線）に、その配下を Base ▸ Plan のパンくずで区切って表示する。
export const DslLayoutTree: React.FC<DslLayoutTreeProps> = ({
  groups,
  cardSize = 210,
  selectedItemId,
  onSelectLayout,
  onDoubleClick,
  isInitializing,
  emptyMessage = '該当する項目がありません',
}) => {
  const totalItems = groups.reduce(
    (n, g) => n + g.sections.reduce((m, s) => m + s.items.length, 0),
    0,
  );

  if (isInitializing && groups.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, height: '100%' }}>
        <CircularProgress sx={{ color: '#00BFFF' }} />
      </Box>
    );
  }

  if (!isInitializing && totalItems === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', gap: 1.5, py: 6 }}>
        <ShapeLineRoundedIcon sx={{ fontSize: 48, color: 'rgba(0,191,255,0.2)', mb: 0.5 }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        px: 2,
        py: 1,
        opacity: isInitializing ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.18)', borderRadius: 2 },
      }}
    >
      {groups.map((group) => {
        const projectCount = group.sections.reduce((m, s) => m + s.items.length, 0);
        return (
          <Box key={group.projectId} sx={{ mb: 3 }}>
            {/* Project header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                pb: 0.75,
                mb: 1.25,
                borderBottom: '1px solid rgba(148,163,184,0.18)',
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'rgba(2,6,23,0.9)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <CorporateFareRoundedIcon sx={{ fontSize: 17, color: '#fa709a' }} />
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 0.2 }}>
                {group.projectName}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>
                {projectCount}
              </Typography>
            </Box>

            {group.sections.map((section) => (
              <Box key={section.key} sx={{ mb: 1.5 }}>
                {/* Breadcrumb (Base ▸ Plan …) */}
                {section.breadcrumb && section.breadcrumb.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 0.75, pl: 0.5, flexWrap: 'wrap' }}>
                    {section.breadcrumb.map((crumb, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && (
                          <ChevronRightRoundedIcon sx={{ fontSize: 13, color: 'rgba(148,163,184,0.4)' }} />
                        )}
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: i === section.breadcrumb!.length - 1 ? 700 : 500,
                            color: i === 0 ? '#34d399' : 'rgba(0,191,255,0.85)',
                          }}
                        >
                          {crumb}
                        </Typography>
                      </React.Fragment>
                    ))}
                  </Box>
                )}

                {section.items.length === 0 ? (
                  section.emptyHint ? (
                    <Typography sx={{ pl: 1.5, py: 0.5, fontSize: 11, color: 'rgba(148,163,184,0.4)' }}>
                      {section.emptyHint}
                    </Typography>
                  ) : null
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fill, ${cardSize}px)`,
                      gap: '12px',
                      justifyContent: 'start',
                      pl: 0.5,
                    }}
                  >
                    {section.items.map((item) => (
                      <DslLayoutCard
                        key={item.id}
                        item={item}
                        cardSize={cardSize}
                        isSelected={selectedItemId === item.id}
                        onSelect={onSelectLayout}
                        onDoubleClick={onDoubleClick}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
};
