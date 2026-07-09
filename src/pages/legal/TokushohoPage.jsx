import React from "react";
import { Box, Container, Typography, Table, TableBody, TableRow, TableCell } from "@mui/material";
import { BRAND } from "@/shared/ui/theme";

// ─────────────────────────────────────────────────────────────
// 特定商取引法に基づく表記
// 個人事業主のため、住所・電話番号は「請求があれば遅滞なく開示」表記としている
// （特定商取引法通信販売広告の表示に関するガイドラインで認められた簡略化）。
// ─────────────────────────────────────────────────────────────
const DISCLOSE_ON_REQUEST = true; // 住所・電話を「請求時に開示」にする場合 true

const INFO = {
  operatorName: "谷岡 佑馬",
  operatorTitle: "運営統括責任者",
  operatorPerson: "谷岡 佑馬",
  address: "（所在地を記入）",
  phone: "（電話番号を記入）",
  email: "hello@sekkeiya.com",
  discloseNote:
    "所在地および電話番号は、消費者からの請求があった場合に遅滞なく開示いたします。ご希望の方は上記メールアドレスまでご連絡ください。",
};

// 料金は Firestore `plans` / TOPUP_PACKS と一致させること（変更時は両方更新）。
const ROWS = [
  { label: "販売事業者名", value: INFO.operatorName },
  { label: INFO.operatorTitle, value: INFO.operatorPerson },
  {
    label: "所在地",
    value: DISCLOSE_ON_REQUEST ? "請求に基づき遅滞なく開示します（下記備考参照）" : INFO.address,
  },
  {
    label: "電話番号",
    value: DISCLOSE_ON_REQUEST ? "請求に基づき遅滞なく開示します（下記備考参照）" : INFO.phone,
  },
  { label: "メールアドレス", value: INFO.email },
  { label: "お問い合わせ受付", value: "メールにて随時受付（原則2〜3営業日以内に返信）" },
  {
    label: "販売価格",
    value: (
      <>
        月額サブスクリプション（税込）：Free ¥0 / Standard ¥1,980 / Premium ¥2,980 / Pro ¥4,900 / Enterprise 応相談。
        <br />
        追加クレジット（top-up・税込）：¥1,200 / ¥3,000 / ¥8,800。
        <br />
        寄付：100円以上の任意額。
        <br />
        各プランの最新価格は料金ページ（/pricing）に表示されます。
      </>
    ),
  },
  {
    label: "商品代金以外の必要料金",
    value: "インターネット接続に必要な通信料等はお客様のご負担となります。当社が別途手数料を請求することはありません。",
  },
  { label: "支払方法", value: "クレジットカード決済（Stripe を利用）" },
  {
    label: "支払時期",
    value:
      "サブスクリプションは申込時に初回課金され、以降は毎月同日に自動更新・課金されます。追加クレジットおよび寄付はお申込みのつど決済されます。",
  },
  {
    label: "サービス提供時期",
    value: "決済完了後、直ちにお客様のアカウントへ反映され、ご利用いただけます。",
  },
  {
    label: "解約・返品・返金",
    value: (
      <>
        本サービスはデジタルコンテンツ・オンラインサービスの性質上、原則として購入後の返品・返金はお受けできません。
        <br />
        サブスクリプションはマイページの請求管理（Stripe カスタマーポータル）よりいつでも解約でき、解約後は次回更新日以降の課金が停止します。日割り返金は行いません。
        <br />
        システム側の障害等により生成処理が失敗した場合、消費されたクレジットは自動的に返還されます。
        <br />
        寄付は返金の対象外です。
      </>
    ),
  },
  {
    label: "動作環境",
    value: "最新版の Google Chrome など、モダンな Web ブラウザでのご利用を推奨します。",
  },
];

export default function TokushohoPage() {
  return (
    <Box sx={{ bgcolor: BRAND.bg, minHeight: "100vh", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Typography variant="h3" sx={{ color: BRAND.text, fontWeight: 800, mb: 1.5, fontSize: { xs: "1.8rem", md: "2.4rem" } }}>
          特定商取引法に基づく表記
        </Typography>
        <Typography sx={{ color: BRAND.sub, mb: 5, lineHeight: 1.8 }}>
          特定商取引法（通信販売）第11条に基づき、以下のとおり表示します。
        </Typography>

        <Table sx={{ "& td": { borderColor: BRAND.line, verticalAlign: "top", py: 2 } }}>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.label}>
                <TableCell sx={{ color: BRAND.text, fontWeight: 700, width: { xs: 130, md: 240 }, fontSize: "0.9rem" }}>
                  {row.label}
                </TableCell>
                <TableCell sx={{ color: BRAND.sub, lineHeight: 1.9, fontSize: "0.9rem" }}>
                  {row.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {DISCLOSE_ON_REQUEST && (
          <Typography sx={{ color: BRAND.sub2, mt: 4, fontSize: "0.85rem", lineHeight: 1.9 }}>
            ※ {INFO.discloseNote}
          </Typography>
        )}

        <Typography sx={{ color: BRAND.sub2, mt: 6, fontSize: "0.8rem" }}>
          最終更新日：2026年7月2日
        </Typography>
      </Container>
    </Box>
  );
}
