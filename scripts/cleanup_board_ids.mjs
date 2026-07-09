import fs from 'fs';
import path from 'path';

const filesToProcess = [
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/components/HeroSection.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/BoardDetailPage/BoardDetailPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/AllBoardsPage/AllBoardsPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/features/ProjectBoard/BoardDetailPageContent.jsx'
];

let r = 0;
filesToProcess.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    const orig = content;

    // contextual replacements inside these specific large files
    content = content.replace(/\bboardId\b/g, "projectId");
    // fix some variable names that became weird
    content = content.replace(/\bownerIdForMyBoard\b/g, "ownerIdForMyProject");
    content = content.replace(/\bheroBoard\b/g, "heroProject");
    content = content.replace(/\bteamBoardExists\b/g, "teamProjectExists");
    content = content.replace(/\bsetTeamBoardExists\b/g, "setTeamProjectExists");
    content = content.replace(/\bboardLive\b/g, "projectLive");
    content = content.replace(/\bsetBoardLive\b/g, "setProjectLive");
    content = content.replace(/\bboardForHook\b/g, "projectForHook");
    content = content.replace(/\bisBoardEmpty\b/g, "isProjectEmpty");

    // Fix imports / URLs
    content = content.replace(/\?projectId=/g, "?projectId=");
    
    if (content !== orig) {
      fs.writeFileSync(f, content, 'utf8');
      console.log('Modified:', f.replace(/\\\\/g, '/'));
      r++;
    }
  }
});

console.log('Total boardId cleanup files updated:', r);
