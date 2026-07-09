import React from "react";
import { Box, Container, Typography, Stack } from "@mui/material";
import { BRAND } from "@/shared/ui/theme";

const SECTIONS = [
  {
    title: "第1条（適用）",
    body: `本規約は、SEKKEIYA（以下「当社」）が提供するAI設計OS「SEKKEIYA」（以下「本サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意の上、本サービスを利用するものとします。`,
  },
  {
    title: "第2条（アカウント登録）",
    body: `本サービスの利用を希望する者は、当社所定の方法によりアカウント登録を行うものとします。ユーザーは、登録情報を最新かつ正確に保つものとし、アカウントの管理について自己の責任を負うものとします。`,
  },
  {
    title: "第3条（料金及び支払い）",
    body: `本サービスの利用料金は、料金ページ（/pricing）に表示するとおりとします。
・月額サブスクリプションは、申込時に初回課金され、以降は毎月自動更新・課金されます。ユーザーはマイページよりいつでも解約できますが、日割り返金は行いません。
・追加クレジット（top-up）は都度課金とし、購入したクレジットは本サービス内での利用にのみ充当されます。
・決済は Stripe, Inc. の決済システムを通じて処理されます。`,
  },
  {
    title: "第4条（禁止事項）",
    body: `ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
・法令又は公序良俗に違反する行為
・当社又は第三者の知的財産権、肖像権その他の権利を侵害する行為
・本サービスの運営を妨害する行為
・不正な目的をもって本サービスを利用する行為
・アカウントを第三者に貸与、譲渡する行為
・その他、当社が不適切と判断する行為`,
  },
  {
    title: "第5条（本サービスの停止・変更・終了）",
    body: `当社は、システムの保守、障害への対応その他の合理的な理由により、事前の通知なく本サービスの全部又は一部の提供を停止、変更することがあります。また、当社は事業上の判断により、本サービスの提供を終了することができるものとし、この場合、合理的な期間をもって事前に告知します。`,
  },
  {
    title: "第6条（生成物・データの取り扱い）",
    body: `ユーザーが本サービスを通じて生成・アップロードしたデータ及び生成物の知的財産権は、法令上当然に当社に帰属するものを除き、ユーザーに帰属します。当社は、本サービスの提供・改善に必要な範囲で当該データを利用することがあります。`,
  },
  {
    title: "第7条（免責事項）",
    body: `当社は、本サービスに事実上又は法律上の瑕疵がないことを明示的にも黙示的にも保証しません。当社は、本サービスに起因してユーザーに生じた損害について、当社の故意又は重過失による場合を除き、一切の責任を負わないものとします。`,
  },
  {
    title: "第8条（利用規約の変更）",
    body: `当社は、必要と判断した場合には、ユーザーへの事前通知の上、本規約を変更できるものとします。変更後の本規約は、本サービス上に掲示した時点から効力を生じるものとします。`,
  },
  {
    title: "第9条（準拠法・管轄裁判所）",
    body: `本規約の解釈にあたっては日本法を準拠法とします。本サービスに関して紛争が生じた場合には、当社の所在地を管轄する裁判所を第一審の専属的合意管轄とします。`,
  },
  {
    title: "第10条（お問い合わせ）",
    body: `本規約に関するお問い合わせは、下記までご連絡ください。
メールアドレス：hello@sekkeiya.com`,
  },
];

export default function TermsOfServicePage() {
  return (
    <Box sx={{ bgcolor: BRAND.bg, minHeight: "100vh", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Typography variant="h3" sx={{ color: BRAND.text, fontWeight: 800, mb: 1.5, fontSize: { xs: "1.8rem", md: "2.4rem" } }}>
          利用規約
        </Typography>
        <Typography sx={{ color: BRAND.sub, mb: 5, lineHeight: 1.8 }}>
          本規約は、SEKKEIYA（sekkeiya.com、以下「本サービス」）のご利用条件を定めるものです。
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
