const { execSync } = require('child_process');
const cwd = 'C:\\Users\\sekkeiya\\02-WebApp\\028-R3DM-ver2\\r3dm-share';

console.log("Restoring MyPageBoardModels.jsx and PublicBoardModelsPage.jsx...");
execSync('git checkout src/features/Dashboard/MyPage/MyPageBoardModels.jsx src/features/Dashboard/Main/AllBoardsPage/PublicBoardModelsPage.jsx', { cwd, stdio: 'inherit' });
console.log("Done.");
