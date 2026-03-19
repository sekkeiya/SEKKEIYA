const { execSync } = require('child_process');
try {
  console.log("Creating PR...");
  execSync('gh pr create --title "feat: AI補完バックエンドの推論精度向上とコンテキスト強化" -F .pr_body.md', {stdio: 'inherit'});
  console.log("Merging PR...");
  execSync('gh pr merge --merge --delete-branch', {stdio: 'inherit'});
  console.log("Done.");
} catch(e) {
  console.error("Error:", e.message);
}
