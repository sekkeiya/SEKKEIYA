import React from "react";
import { Box, Container, Typography, Stack, Button } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import EmailIcon from "@mui/icons-material/Email";
import { BRAND } from "@/shared/ui/theme";

const FAQS = [
  {
    q: "サブスクリプションを解約したい",
    a: "ログイン後、ワークスペースの請求管理（Stripe カスタマーポータル）よりいつでも解約できます。解約後は次回更新日以降の課金が停止します。",
  },
  {
    q: "クレジットが足りなくなった",
    a: "料金ページ（/pricing）から追加クレジット（top-up）を購入できます。決済完了後、即座にアカウントへ反映されます。",
  },
  {
    q: "生成処理が失敗した・クレジットが消費された",
    a: "システム側の障害等により生成処理が失敗した場合、消費されたクレジットは自動的に返還されます。数分待っても反映されない場合はお問い合わせください。",
  },
  {
    q: "支払い方法や請求内容について確認したい",
    a: "ワークスペースの請求管理から、決済履歴や次回請求日をご確認いただけます。ご不明な点はお問い合わせください。",
  },
];

export default function SupportPage() {
  return (
    <Box sx={{ bgcolor: BRAND.bg, minHeight: "100vh", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Typography variant="h3" sx={{ color: BRAND.text, fontWeight: 800, mb: 1.5, fontSize: { xs: "1.8rem", md: "2.4rem" } }}>
          サポート
        </Typography>
        <Typography sx={{ color: BRAND.sub, mb: 5, lineHeight: 1.8 }}>
          ご利用に関するご質問・お困りごとは、以下をご確認いただくか、メールでお問い合わせください。
        </Typography>

        <Box
          sx={{
            p: 3, mb: 6, borderRadius: 2,
            bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`,
            display: "flex", flexDirection: { xs: "column", sm: "row" },
            alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ color: BRAND.text, fontWeight: 700, mb: 0.5 }}>お問い合わせ</Typography>
            <Typography sx={{ color: BRAND.sub, fontSize: "0.9rem" }}>
              原則2〜3営業日以内にメールにて返信いたします。
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            href="mailto:hello@sekkeiya.com"
            sx={{ whiteSpace: "nowrap" }}
          >
            hello@sekkeiya.com
          </Button>
        </Box>

        <Typography sx={{ color: BRAND.text, fontWeight: 700, mb: 2.5, fontSize: "1.1rem" }}>
          よくあるご質問
        </Typography>
        <Stack spacing={3} sx={{ mb: 6 }}>
          {FAQS.map((f) => (
            <Box key={f.q}>
              <Typography sx={{ color: BRAND.text, fontWeight: 600, mb: 0.75, fontSize: "0.95rem" }}>
                Q. {f.q}
              </Typography>
              <Typography sx={{ color: BRAND.sub, lineHeight: 1.9, fontSize: "0.9rem" }}>
                A. {f.a}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button component={RouterLink} to="/pricing" variant="outlined" sx={{ color: BRAND.text, borderColor: BRAND.line }}>
            料金プランを見る
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
