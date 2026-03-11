import fs from 'fs';

let content = fs.readFileSync('firestore.rules', 'utf8');

// Replace teamBoards
const teamBoardsRegex = /\/\* ---- teamBoards ---- \*\/[\s\S]+?(\/\* ✅ 保険：未定義サブコレクションも contributor は触れる \*\/[\s\S]+?match \/\{document=\*\*\} \{\s+allow read, write: if _isOwner\(\) \|\| _isMember\(\);\s+\}\s+\})/;
content = content.replace(teamBoardsRegex, `/* ---- teamBoards (Legacy Schema Blocked) ---- */
    match /teamBoards/{document=**} {
      allow read, write: if false;
    }`);

// Replace myBoards
const myBoardsRegex = /\/\* ✅ 修正：myBoards は owner のみに制限 \*\/[\s\S]+?(\/\* ✅ 保険：未定義のサブコレクションが増えても owner は触れる \*\/[\s\S]+?match \/\{document=\*\*\} \{\s+allow read, write: if isMyBoardOwner\(userId\);\s+\}\s+\})/;
content = content.replace(myBoardsRegex, `/* ---- users/{userId}/myBoards (Legacy Schema Blocked) ---- */
      match /myBoards/{document=**} {
        allow read, write: if false;
      }`);

// Replace user teamBoards
const userTeamBoardsRegex = /\/\/ 🔴 ユーザー配下の teamBoards リンク[\s\S]+?match \/teamBoards\/\{docId\} \{\s+\/\/ 自分のものだけ見える[\s\S]+?match \/models\/\{modelId\} \{\s+allow read: if isSignedIn\(\) && request\.auth\.uid == userId;\s+allow write: if false; \/\/ Legacy Schema Write Blocked\s+\}\s+\}/;
content = content.replace(userTeamBoardsRegex, `// 🔴 ユーザー配下の teamBoards リンク (Legacy Schema Blocked)
      match /teamBoards/{document=**} {
        allow read, write: if false;
      }`);

fs.writeFileSync('firestore.rules', content);
console.log("firestore.rules patched successfully.");
