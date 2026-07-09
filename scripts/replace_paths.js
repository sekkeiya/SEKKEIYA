const fs = require('fs');

const files = [
    "c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/read.js",
    "c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/getBoardItems.js",
    "c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/boards.js",
    "c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/boards/actions.js",
    "c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/features/ProjectBoard/BoardDetailInformation.jsx",
    "c:/Users/sekkeiya/02-WebApp/040-sekkeiya/sekkeiya/src/shared/api/emails/teamInvites.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/utils/planLimitcheckers.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/layout/DashboardLayout/RightSidebar/EditBoardRightSidebar/components/hooks.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/boards.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/boards/actions.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/features/Dashboard/Main/BoardListPage/components/articleBoardPublic.jsx",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/utils/debug/firestoreDebug.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/layout/DashboardLayout/RightSidebar/EditModelRightSidebar/hooks/useEditModelRightSidebar.js",
    "c:/Users/sekkeiya/02-WebApp/028-R3DM-ver2/r3dm-share/src/shared/api/emails/teamInvites.js"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // teamBoards replacements
  content = content.replace(/doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,)]+)\s*,\s*["']models[^"']*["']\s*,\s*([^)]+)\)/g, 'doc(db, "boards", $1, "items", $2)');
  content = content.replace(/doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,)\s]+)\)/g, 'doc(db, "boards", $1)');
  content = content.replace(/collection\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^,)]+)\s*,\s*(.*?)\)/g, 'collection(db, "boards", $1, $2)');
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']teamBoards["']\s*,\s*([^)]+)\)\s*,\s*(.*?)\)/g, 'collection(db, "boards", $1, $2)');
  content = content.replace(/collection\(\s*db\s*,\s*["']teamBoards["']\s*\)/g, 'collection(db, "boards")');

  // myBoards replacements
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,)]+)\s*,\s*["']models[^"']*["']\s*,\s*([^)]+)\)/g, 'doc(db, "boards", $2, "items", $3)');
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,)\s]+)\)/g, 'doc(db, "boards", $2)');
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,)]+)\s*,\s*["']models[^"']*["']\s*\)/g, 'collection(db, "boards", $2, "items")');
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^,)]+)\s*,\s*(.*?)\)/g, 'collection(db, "boards", $2, $3)');
  content = content.replace(/collection\(\s*doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*,\s*([^)]+)\)\s*,\s*(.*?)\)/g, 'collection(db, "boards", $2, $3)');
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']myBoards["']\s*\)/g, 'collection(db, "boards")');

  // users teamBoards link replacements
  content = content.replace(/doc\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']teamBoards["']\s*,\s*([^,)\s]+)\)/g, 'doc(db, "boards", $2)');
  content = content.replace(/collection\(\s*db\s*,\s*["']users["']\s*,\s*([^,]+)\s*,\s*["']teamBoards["']\s*\)/g, 'collection(db, "boards")');

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log("Updated: " + file);
  } else {
    console.log("No changes: " + file);
  }
}
