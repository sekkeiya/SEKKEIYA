import React, { useState, useEffect, useRef } from "react";
import { Box, Container, Typography, Stack, Divider } from "@mui/material";
import { motion } from "framer-motion";
import { BRAND } from "@/shared/ui/theme";
import { SEO } from "@/shared/components/seo/SEO";

const PURPLE       = "#7C3AED";
const PURPLE_SOFT  = "rgba(124,58,237,0.10)";
const GRAD_TEXT    = "linear-gradient(135deg, #A78BFA 0%, #60A5FA 100%)";
const GRAD_PRIMARY = "linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)";

// ── Typography helpers ────────────────────────────────────────────────────────

const GradSpan = ({ children }) => (
  <Box component="span" sx={{ background: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
    {children}
  </Box>
);

const SectionNum = ({ n }) => (
  <Typography component="span" sx={{ fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 700,
    color: PURPLE, letterSpacing: "0.14em", mr: 2, opacity: 0.9 }}>
    {String(n).padStart(2, "0")}
  </Typography>
);

const Prose = ({ children, sx }) => (
  <Typography sx={{
    fontSize: { xs: "1rem", md: "1.05rem" },
    lineHeight: 2.0,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: "0.01em",
    ...sx,
  }}>
    {children}
  </Typography>
);

const PullQuote = ({ children }) => (
  <Box sx={{ my: { xs: 5, md: 7 }, pl: 3,
    borderLeft: `3px solid ${PURPLE}`,
    background: `linear-gradient(90deg, ${PURPLE_SOFT}, transparent)`,
    borderRadius: "0 8px 8px 0", py: 2.5, pr: 3 }}>
    <Typography sx={{
      fontSize: { xs: "1.2rem", md: "1.45rem" },
      fontWeight: 700, lineHeight: 1.7, letterSpacing: "-0.01em",
      background: GRAD_TEXT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
    }}>
      {children}
    </Typography>
  </Box>
);

const CodeBlock = ({ children }) => (
  <Box sx={{ my: 4, p: 3, bgcolor: "#0a0a0a", borderRadius: 2,
    border: "1px solid rgba(255,255,255,0.08)", fontFamily: "monospace",
    fontSize: "0.88rem", lineHeight: 2.0, color: "rgba(255,255,255,0.6)",
    whiteSpace: "pre", overflowX: "auto" }}>
    {children}
  </Box>
);

const SectionHeading = ({ id, num, children }) => (
  <Box id={id} sx={{ pt: { xs: 10, md: 14 }, scrollMarginTop: 80 }}>
    <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, ease: [0.16,1,0.3,1] }}>
      <Typography variant="h2" sx={{
        fontWeight: 900, fontSize: { xs: "1.6rem", md: "2.2rem" },
        letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.3,
      }}>
        <SectionNum n={num} />{children}
      </Typography>
      <Box sx={{ mt: 3, mb: 5, height: 1, background: `linear-gradient(90deg, ${PURPLE}44, transparent)` }} />
    </motion.div>
  </Box>
);

const SubHeading = ({ children }) => (
  <Typography variant="h4" sx={{
    fontWeight: 800, fontSize: { xs: "1.1rem", md: "1.25rem" },
    color: "#fff", letterSpacing: "-0.02em", mt: 6, mb: 2.5,
    display: "flex", alignItems: "center", gap: 1.5,
    "&::before": { content: '""', display: "inline-block", width: 4, height: "1em",
      background: GRAD_PRIMARY, borderRadius: 1, flexShrink: 0, verticalAlign: "middle" }
  }}>
    {children}
  </Typography>
);

const BulletItem = ({ children }) => (
  <Box sx={{ display: "flex", gap: 2, mb: 1.5 }}>
    <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: PURPLE, mt: "0.65em", flexShrink: 0 }} />
    <Prose>{children}</Prose>
  </Box>
);

// ── TOC ───────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "s1", num: "01", label: "問いの始まり" },
  { id: "s2", num: "02", label: "原点——Rhinoの小さな不満から" },
  { id: "s3", num: "03", label: "SEKKEIYAとは何か" },
  { id: "s4", num: "04", label: "アーキテクチャ——三層構造のエコシステム" },
  { id: "s5", num: "05", label: "なぜ「OS」という比喩なのか" },
  { id: "s6", num: "06", label: "設計者の役割が変わる" },
  { id: "s7", num: "07", label: "現在地と、これから" },
];

function TableOfContents({ activeId }) {
  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box>
      <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: BRAND.sub2,
        letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "monospace", mb: 3 }}>
        Contents
      </Typography>
      <Stack spacing={0.5}>
        {TOC_ITEMS.map((item) => {
          const active = activeId === item.id;
          return (
            <Box key={item.id} onClick={() => scrollTo(item.id)} sx={{
              display: "flex", alignItems: "baseline", gap: 1.5, cursor: "pointer",
              py: 0.7, px: 1.2, borderRadius: 1.5,
              bgcolor: active ? "rgba(124,58,237,0.12)" : "transparent",
              transition: "all 0.2s",
              "&:hover": { bgcolor: "rgba(124,58,237,0.08)" },
            }}>
              <Typography sx={{ fontFamily: "monospace", fontSize: "0.65rem", color: active ? PURPLE : BRAND.sub2,
                fontWeight: 700, letterSpacing: "0.1em", flexShrink: 0, transition: "color 0.2s" }}>
                {item.num}
              </Typography>
              <Typography sx={{ fontSize: "0.82rem", color: active ? "#fff" : BRAND.sub,
                fontWeight: active ? 700 : 400, lineHeight: 1.4, transition: "color 0.2s" }}>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VisionPage() {
  const [activeId, setActiveId] = useState("s1");
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) { observer.observe(el); sectionRefs.current[id] = el; }
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <SEO title="Vision — SEKKEIYA" description="AIによる設計OS——可能性の全域を、ひとりの設計者に。SEKKEIYAのコンセプトとビジョン。" path="/vision" />
      <Box sx={{ bgcolor: "#000", color: BRAND.text, minHeight: "100vh" }}>

        {/* ── Hero ── */}
        <Box sx={{ pt: { xs: 18, md: 24 }, pb: { xs: 10, md: 14 }, position: "relative", overflow: "hidden",
          borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Box sx={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: "120%", height: "100%",
            background: "radial-gradient(ellipse at 50% -20%, rgba(124,58,237,0.18) 0%, transparent 60%)",
            pointerEvents: "none" }} />
          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.16,1,0.3,1] }}>
              <Stack spacing={1} sx={{ mb: 5 }}>
                <Typography sx={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700,
                  color: PURPLE, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                  SEKKEIYA — Vision Document
                </Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: "0.72rem",
                  color: BRAND.sub2, letterSpacing: "0.08em" }}>
                  Published 2026
                </Typography>
              </Stack>

              <Typography variant="h1" sx={{
                fontWeight: 900, fontSize: { xs: "2.4rem", sm: "3.4rem", md: "4.5rem" },
                letterSpacing: "-0.04em", lineHeight: 1.1, color: "#fff", maxWidth: 820,
              }}>
                AIによる設計OS——<br />
                <GradSpan>可能性の全域を、</GradSpan><br />
                ひとりの設計者に。
              </Typography>

              <Box sx={{ mt: 6, maxWidth: 640 }}>
                <Prose sx={{ fontSize: "1.1rem", lineHeight: 1.9, color: "rgba(255,255,255,0.65)" }}>
                  建築・インテリア設計の現場に根ざし、テクノロジーで設計の構造的限界を突き破る。
                  SEKKEIYAが何を目指し、なぜそれを作るのか——この文書はその問いへの答えだ。
                </Prose>
              </Box>
            </motion.div>
          </Container>
        </Box>

        {/* ── Body: TOC + Content ── */}
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Box sx={{ display: "flex", gap: { xs: 0, lg: 10 }, alignItems: "flex-start" }}>

            {/* Sticky TOC — desktop */}
            <Box sx={{ display: { xs: "none", lg: "block" }, width: 240, flexShrink: 0,
              position: "sticky", top: 88, alignSelf: "flex-start" }}>
              <TableOfContents activeId={activeId} />
            </Box>

            {/* Main content */}
            <Box sx={{ flex: 1, minWidth: 0 }}>

              {/* Mobile TOC */}
              <Box sx={{ display: { xs: "block", lg: "none" }, mb: 8,
                p: 3, borderRadius: 3, bgcolor: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)" }}>
                <TableOfContents activeId={activeId} />
              </Box>

              {/* ── Section 1 ── */}
              <SectionHeading id="s1" num={1}>問いの始まり</SectionHeading>
              <Prose>
                建築やインテリアの設計に長く携わってきた人間なら、一度は同じ問いに突き当たるはずだ。
              </Prose>

              <PullQuote>「最高の提案とは、いったい何か」</PullQuote>

              <Prose>
                答えは、ある意味でシンプルだ。最高の提案とは、考えられる限りすべての可能性を検討し、その中で最後まで生き残った1案のことだ。何百、何千の選択肢と向き合い、比較し、潰し、削ぎ落とした末に残ったもの——それだけが、本当に「これしかない」と言える提案になる。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                しかし現実はそうではない。設計者が1日で作れる案は、せいぜい1案か2案だ。人間の認知能力と時間には、限りがある。締め切りが迫り、他の業務が重なる中で、設計者は「考えられた範囲」の中から提案を出す。それは決して怠慢ではない。<strong style={{ color: "#fff" }}>構造的な限界</strong>だ。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                この限界を、テクノロジーで突き破れないか——それがSEKKEIYAを作り始めた動機だった。
              </Prose>

              {/* ── Section 2 ── */}
              <SectionHeading id="s2" num={2}>原点——Rhinoの小さな不満から</SectionHeading>
              <Prose>
                壮大な問いは、しかし、小さな不満から始まった。学生時代からRhinoを使い続けてきた。3Dモデリングツールとして、Rhinoは表現の自由度が高く、今も大好きなツールだ。ただ、インテリア設計の場面でRhinoを使おうとすると、ある作業が繰り返し発生することに気づいていた。
              </Prose>

              <PullQuote>家具の3Dモデルを図面に挿入する作業が、思いのほか手間だ。</PullQuote>

              <Prose>
                「ここにソファを置いたらどう見えるか」「このテーブルのサイズ感は合っているか」——そういった検討を素早くやりたいのに、モデルを探して、インポートして、スケールを合わせる作業が毎回発生する。たった一つの家具を試すだけで、思考のリズムが途切れる。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                だったら、ワンクリックで挿入できればいい。そのシンプルな発想から生まれたのが<strong style={{ color: "#fff" }}>S.Model</strong>だ。家具の3DモデルをRhinoにワンクリックで挿入できるツール。これが今のSEKKEIYAの原点であり、最初の「子アプリ」になった。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                しかしS.Modelを作りながら、問いはより大きく広がっていった。単に挿入を楽にするだけでなく、設計の可能性そのものを広げるツールが作れないか、と。
              </Prose>

              {/* ── Section 3 ── */}
              <SectionHeading id="s3" num={3}>SEKKEIYAとは何か——設計特化のAI OS</SectionHeading>
              <Prose>
                SEKKEIYAは「建築・インテリア設計者のためのAIプラットフォーム」と説明することが多い。ただ、その本質をより正確に表現するなら、こう言いたい。
              </Prose>

              <PullQuote>SEKKEIYAは、設計に特化したAI OSだ。</PullQuote>

              <Prose>
                OSとは何か。それは、個々のアプリケーションを束ね、ユーザーとアプリの間に立って、リソースを適切に配分し、体験を統合するシステムだ。スマートフォンのOSを想像してほしい。iOSやAndroidは、カメラ、マップ、メッセージ、決済——多種多様なアプリを動かす基盤として機能している。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                SEKKEIYAの構図もそれに近い。ただし、決定的な違いが一つある。SEKKEIYAでは、アプリの取捨選択と実行を、<strong style={{ color: "#fff" }}>AIエージェントが担う</strong>。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                設計者が「この空間の提案書を作りたい」と語れば、SEKKEIYAのAIが判断する。今何が必要か。どのアプリを起動するか。どの順序で処理するか。外部サービスとどう連携するか。設計者は意図を伝えるだけでいい。プロセスはAIが組み立てる。
              </Prose>

              {/* ── Section 4 ── */}
              <SectionHeading id="s4" num={4}>アーキテクチャ——三層構造のエコシステム</SectionHeading>
              <Prose>SEKKEIYAは三つの層から成り立っている。</Prose>

              <SubHeading>層1：AIエージェント（カーネル）</SubHeading>
              <Prose>
                中心に位置するのがSEKKEIYA AIだ。これはOSのカーネルに相当する。設計者の意図を解釈し、必要なツールやアプリを選択・実行し、それらの出力を統合して、最終的な成果物へと導く。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                重要なのは、AIが単なる「検索エンジン」や「補助ツール」ではないという点だ。AIは<strong style={{ color: "#fff" }}>実行者</strong>だ。どのアプリを使うか、どの外部サービスに問い合わせるか、どの順序でタスクを処理するか——それを自律的に判断し、行動する。
              </Prose>

              <SubHeading>層2：子アプリ群（アプリケーション層）</SubHeading>
              <Prose sx={{ mb: 3 }}>
                AIが操作する道具として、複数の子アプリが存在する。子アプリは設計プロセスの各フェーズに対応している。
              </Prose>
              <BulletItem><strong style={{ color: "#fff" }}>S.Model</strong>：3Dモデルの管理・共有・Rhinoへの挿入</BulletItem>
              <BulletItem><strong style={{ color: "#fff" }}>S.Layout</strong>：家具配置とレイアウトのキャンバス</BulletItem>
              <BulletItem><strong style={{ color: "#fff" }}>S.Slide</strong>：提案書・ダイアグラムの作成</BulletItem>
              <BulletItem><strong style={{ color: "#fff" }}>S.Create</strong>：造作家具のパラメトリックビルダー</BulletItem>
              <BulletItem><strong style={{ color: "#fff" }}>AI 3D Generate</strong>：テキスト・画像からの3Dモデル自動生成</BulletItem>

              <Prose sx={{ mt: 4 }}>
                このリストは固定ではない。設計業務の中で新たな「手間」や「不可能」が見つかれば、それを解決する子アプリが追加される。OSがアップデートされるように、SEKKEIYAは子アプリを積み重ねながら成長していく。設計フローの理想形はこうだ。
              </Prose>

              <CodeBlock>{`Rhino（躯体作成）
  → S.Layout（家具配置・空間検討）
    → マテリアル設定（壁・床・天井）
      → AIレンダリング（空間の可視化）
        → S.Slide（提案書の完成）`}</CodeBlock>

              <Prose>このフローをAIが一気通貫で走らせる。それがSEKKEIYAの目指す姿だ。</Prose>

              <SubHeading>層3：エコシステム（拡張層）</SubHeading>
              <Prose>
                三番目の層は、SEKKEIYAの長期的な可能性を定義する。まず、外部サービスとの連携だ。AIレンダリングツール、BIMソフトウェア、施工管理システム、クライアント向けプレゼンテーションプラットフォーム——設計業務を取り巻くサービスは多岐にわたる。SEKKEIYAはこれらと接続し、AIエージェントがそれらも適切に活用できる環境を整えていく。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                そして、<strong style={{ color: "#fff" }}>ユーザー自身によるプラグイン開発</strong>だ。これが、SEKKEIYAを「ツール」から「OS」へと昇格させる最後のピースだ。特定の設計事務所のワークフロー、特定の材料メーカーのカタログ連携、特定のクライアント向けの提案フォーマット——そういった個別ニーズに対して、SEKKEIYAはプラットフォームとして開かれていたい。ユーザー自身が機能を追加し、自分のワークフローに最適化されたSEKKEIYAを育てる。そのエコシステムが生まれたとき、SEKKEIYAは設計業界のインフラになる。
              </Prose>

              {/* ── Section 5 ── */}
              <SectionHeading id="s5" num={5}>なぜ「OS」という比喩なのか</SectionHeading>
              <Prose>
                単一の設計ツールと、OSの違いは何か。それは「汎用性」と「拡張性」だ。AutoCADはCADツールだ。Rhinoは3Dモデリングツールだ。どちらも卓越したツールだが、それぞれ特定の目的のために最適化されている。設計者はこれらを組み合わせながら、手作業でワークフローを組み立てる。
              </Prose>

              <PullQuote>SEKKEIYAは特定の作業のためのツールではなく、設計という行為全体を支える基盤だ。</PullQuote>

              <Prose>
                どんな設計タスクが来ても、AIが適切なアプリや外部サービスを組み合わせて対応する。設計者が「こういう空間を提案したい」と思ったとき、それを実現するためのプロセスをSEKKEIYAが構築する。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                スマートフォンが登場したとき、それは「電話に機能が追加されたもの」ではなかった。電話、カメラ、地図、支払い——それらを束ねる新しいプラットフォームの誕生だった。SEKKEIYAも同じように、設計ツールの延長ではなく、設計業務のための新しいプラットフォームとして存在したい。
              </Prose>

              {/* ── Section 6 ── */}
              <SectionHeading id="s6" num={6}>設計者の役割が変わる</SectionHeading>
              <Prose>
                SEKKEIYAが目指す世界では、設計者の仕事の重心が変わる。今日の設計者は、多くの時間をツールの操作に費やしている。ファイルを探し、モデルをインポートし、スケールを合わせ、レンダリングを待ち、提案書のレイアウトを整える。これらは本来、設計者が本質的にやりたいことではない。
              </Prose>

              <PullQuote>設計者が本当にやりたいのは、考えることだ。</PullQuote>

              <Prose>
                空間を構想し、素材の組み合わせを想像し、クライアントの生活を思い描き、可能性を探ること。それが設計という行為の核心だ。SEKKEIYAはその核心に集中できる環境を作る。操作はAIに任せ、設計者は意図と判断に専念する。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                「この方向でいい」「もっと開放的にしたい」「予算を抑えたい」——そういった設計者の声に、AIが応え、空間の可能性を広げていく。何千もの配置パターンを試し、最高の1案を選ぶ——それが一人の設計者に可能になる。
              </Prose>

              {/* ── Section 7 ── */}
              <SectionHeading id="s7" num={7}>現在地と、これから</SectionHeading>
              <Prose>
                SEKKEIYAはまだ成長途上のプロダクトだ。現在の姿は、ビジョンの一部を実装したものに過ぎない。AIが全フローを自律的に走らせる段階にはまだ至っていない。しかし、基盤となる子アプリ群は着実に育ちつつあり、設計者が実際に使える状態になってきた。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                開発の方針は一貫している。<strong style={{ color: "#fff" }}>完璧を待たず、実際に使われる状態で届け、現場のフィードバックから学び続ける。</strong>ツールは使われて初めて改善できる。設計の現場で本当に必要なものは、現場から教わる。
              </Prose>
              <Prose sx={{ mt: 3 }}>
                そして、SEKKEIYAを最初に使い倒す人間は、開発者自身だ。自分のコンペ、自分のクライアントへの提案に、SEKKEIYAを使う。それが最も正直な検証であり、最も強い動機になる。
              </Prose>

              <PullQuote>AIによる設計OS——その構想の実現に向けて、SEKKEIYAは動いている。</PullQuote>

              {/* Footer note */}
              <Divider sx={{ borderColor: "rgba(255,255,255,0.07)", mt: 10, mb: 5 }} />
              <Typography sx={{ fontFamily: "monospace", fontSize: "0.82rem",
                color: BRAND.sub2, letterSpacing: "0.06em", fontStyle: "italic" }}>
                SEKKEIYA is built by a designer, for designers.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </>
  );
}
