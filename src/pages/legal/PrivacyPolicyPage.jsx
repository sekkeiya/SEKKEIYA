import React from "react";
import { Box, Container, Typography, Stack } from "@mui/material";
import { BRAND } from "@/shared/ui/theme";

const SECTIONS = [
  {
    title: "1. 基本方針",
    body: `SEKKEIYA（以下「当社」）は、本サービスの利用者（以下「ユーザー」）の個人情報の重要性を認識し、個人情報の保護に関する法律その他の関係法令等を遵守し、適切に取り扱います。`,
  },
  {
    title: "2. 取得する情報",
    body: `当社は、本サービスの提供にあたり、以下の情報を取得することがあります。
・アカウント情報（氏名、メールアドレス、認証情報）
・お支払いに関する情報（決済は Stripe, Inc. が提供する決済サービスを通じて処理され、当社はクレジットカード番号等の情報を直接保持しません）
・本サービスの利用状況（アクセスログ、Cookie、生成・アップロードしたデータ等）
・お問い合わせ時にご提供いただく情報`,
  },
  {
    title: "3. 利用目的",
    body: `取得した情報は、以下の目的で利用します。
・本サービスの提供、維持、改善のため
・料金の請求、決済処理のため
・お問い合わせへの対応のため
・利用規約に違反する行為への対応のため
・本サービスに関する重要なお知らせの通知のため`,
  },
  {
    title: "4. 第三者提供・委託",
    body: `当社は、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。ただし、決済処理を Stripe, Inc. に、データの保管・処理基盤を Google Cloud / Firebase に委託するなど、本サービス提供に必要な範囲で外部事業者に情報の取り扱いを委託することがあります。`,
  },
  {
    title: "5. Cookie 等の利用",
    body: `本サービスは、利用状況の分析やログイン状態の維持のため、Cookie および類似の技術を使用します。ブラウザの設定により Cookie の利用を制限できますが、その場合、本サービスの一部機能がご利用いただけなくなることがあります。`,
  },
  {
    title: "6. 安全管理措置",
    body: `当社は、取得した個人情報の漏えい、滅失又は毀損の防止その他の安全管理のために必要かつ適切な措置を講じます。`,
  },
  {
    title: "7. 開示・訂正・削除等のご請求",
    body: `ユーザーは、当社が保有する自己の個人情報について、開示、訂正、利用停止、削除等を請求することができます。ご請求は下記お問い合わせ先までご連絡ください。本人確認の上、法令に従い対応いたします。`,
  },
  {
    title: "8. 本ポリシーの変更",
    body: `当社は、必要に応じて本ポリシーを変更することがあります。変更後のポリシーは、本ページに掲載した時点から効力を生じるものとします。`,
  },
  {
    title: "9. お問い合わせ窓口",
    body: `本ポリシーに関するお問い合わせは、下記までご連絡ください。
メールアドレス：hello@sekkeiya.com`,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <Box sx={{ bgcolor: BRAND.bg, minHeight: "100vh", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Typography variant="h3" sx={{ color: BRAND.text, fontWeight: 800, mb: 1.5, fontSize: { xs: "1.8rem", md: "2.4rem" } }}>
          プライバシーポリシー
        </Typography>
        <Typography sx={{ color: BRAND.sub, mb: 5, lineHeight: 1.8 }}>
          SEKKEIYA（sekkeiya.com、以下「本サービス」）における個人情報の取り扱いについて定めます。
        </Typography>

        <Stack spacing={4}>
          {SECTIONS.map((s) => (
            <Box key={s.title}>
              <Typography sx={{ color: BRAND.text, fontWeight: 700, mb: 1, fontSize: "1.05rem" }}>{s.title}</Typography>
              <Typography sx={{ color: BRAND.sub, lineHeight: 1.9, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                {s.body}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Typography sx={{ color: BRAND.sub2, mt: 6, fontSize: "0.8rem" }}>
          制定日：2026年7月2日
        </Typography>
      </Container>
    </Box>
  );
}
