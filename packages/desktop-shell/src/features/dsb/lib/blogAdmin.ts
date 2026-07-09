// 公式ブログ(officialArticles)を編集できる管理者の判定。
// 公開ブログ(sekkeiya.com/articles)の持ち主に合わせて hello@sekkeiya.com に統一する。
// Web 側 AdminGuard の adminEmails と一致させること。

/** 公式ブログを編集できる管理者メール。 */
export const BLOG_ADMIN_EMAILS = ['hello@sekkeiya.com'];

/** currentUser（Firebase User 相当）が公式ブログ管理者かどうか。 */
export function isBlogAdmin(user: { email?: string | null } | null | undefined): boolean {
  const email = (user?.email ?? '').trim().toLowerCase();
  return !!email && BLOG_ADMIN_EMAILS.some((e) => e.toLowerCase() === email);
}
