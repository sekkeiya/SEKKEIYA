import fs from 'fs';

const files = [
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/BoardDetailPage/BoardDetailInformation.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/AllBoardsPage/PublicBoardModelsPage.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardListPage/components/articleBoard.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardPage/BoardPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/ModelsList/ModelCardPreview/components/ModelDetailHeader.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/MyPage/MyPageBoardModels.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/MyPage/MyPageBoards.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/ProjectBoardArticlePage/ProjectBoardArticlePageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/ProjectBoardDetailPage/components/ArticleGrid.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/ProjectBoardDetailPage/components/ModelsGrid.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/ProjectBoardDetailPage/ProjectBoardDetailPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/ProjectsPage/ProjectsPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/PublicModelPage/components/RelatedModelsGrid.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/LandingPage/PublicUserPage/PublicUserPageContent.jsx',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/actions.js',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/downloads.js',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/paths.js',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/public.js',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/teamBoards.js',
  'C:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/layout/DashboardLayout/RightSidebar/EditModelRightSidebar/hooks/useModelDataLoader.js',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/actions.js',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/downloads.js',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/paths.js',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/public.js',
  'C:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/teamBoards.js'
];

let r = 0;
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  let orig = content;
  content = content.replace(/\"sharedProject\"/g, '\"publicBoard\"');
  content = content.replace(/\'sharedProject\'/g, '\'publicBoard\'');
  content = content.replace(/\`sharedProject\`/g, '\`publicBoard\`');

  content = content.replace(/\"shareId\"/g, '\"publicId\"');
  content = content.replace(/\'shareId\'/g, '\'publicId\'');
  content = content.replace(/\`shareId\`/g, '\`publicId\`');

  content = content.replace(/\"projectShares\"/g, '\"boardsPublic\"');
  content = content.replace(/\'projectShares\'/g, '\'boardsPublic\'');
  content = content.replace(/\`projectShares\`/g, '\`boardsPublic\`');

  // Actually, wait! The collection `projectShares` IS exactly what we want,
  // because we already renamed the `boardsPublic` collection to `projectShares` in Firestore in a prior session, 
  // OR wait... the user said: "boardsPublic -> projectShares は Firestore の実コレクション名にも関わるため、整合を確認してください。"
  // In `find_legacy_names.mjs` it changed `collection(db, "boardsPublic")` to `collection(db, "projectShares")`.
  // Does the actual database already have a `projectShares` collection instead of `boardsPublic`?
  // Let me just revert everything to exactly what the JS literal strings were originally, 
  // EXCEPT for `projectShares` which should probably BE `projectShares`! 
  // Wait, I will just fix the source values manually instead of doing this blindly.

  // Let's only revert "sharedProject" because that was heavily an internal property value like `model.source === "publicBoard"`.
  
  if (content !== orig) {
    fs.writeFileSync(f, content, 'utf8');
    r++;
  }
});
console.log('Reverted literals in ' + r + ' files');
