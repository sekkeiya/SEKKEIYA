// ツアー定義レジストリ。
// 各ステップ:
//   id, title, body, hint?
//   onEnter?(a): 表示前の副作用（タブ切替・入力など）。a = アクション集（tourActions）
//   target?: スポットライト対象。CSSセレクタ / {text,tag} / {placeholder} / {title} / 関数 / null(中央)
//   waitTarget?: true なら target が現れるまで待ってから表示
//   spotlightPad?: スポットライト枠の余白px
//
// HERO_TOUR: 約2〜3分。設計の流れを物語として体験させ「使いたい」を残す。
// CHAPTERS:  左下ガイドから起動する機能別の深掘りツアー。

const SAMPLE_PROMPT = "20畳のカフェのレイアウトを提案して";

export const HERO_TOUR = {
  id: "hero",
  steps: [
    {
      id: "welcome",
      title: "SEKKEIYAへようこそ",
      body: "ここは、AIと対話しながら空間を設計するOSです。\nこれから実際の画面を動かしながら、何ができるのかをご案内します。所要 約2分。",
      target: null,
    },
    {
      id: "chat",
      title: "① まず、話しかけてみる",
      body: "SEKKEIYAの中心はこのチャットです。「カフェのレイアウトを作って」のように日本語で指示するだけ。AIが各ツールを横断して実行します。",
      hint: "試しに指示文を入れてみました（送信はしません）",
      onEnter: async (a) => {
        await a.ensureChatOpen();
        // 一括入力 + fire-and-forget（ステップ表示をブロックしない）
        a.typeInto({ placeholder: "何でも" }, SAMPLE_PROMPT, { perChar: 0 });
      },
      target: { placeholder: "何でも" },
      waitTarget: true,
    },
    {
      id: "library",
      title: "② AIの「脳」— S.Library",
      body: "なぜ的確に提案できるのか？SEKKEIYAには知識を貯める脳があります。法規・構造・素材などをS.Libraryに蓄えるほど、AIはあなた専用に賢くなります。",
      hint: "右の「＋」からS.Libraryを開けます（後で詳しいツアーも見られます）",
      onEnter: async (a) => { await a.clearInput({ placeholder: "何でも" }); },
      target: '[data-tour="app-launcher"]',
      waitTarget: true,
    },
    {
      id: "layout",
      title: "③ 言葉が、空間になる — S.Layout",
      body: "S.Layoutでは、部屋の条件を指定すればAIが家具を自動配置。複数のレイアウト案を見比べて、気に入ったものを採用できます。",
      hint: "S.Layout に切り替わりました",
      onEnter: async (a) => { await a.switchTab("3dsl"); await a.sleep(700); },
      target: '[data-tour="3dsl"]',
      waitTarget: true,
    },
    {
      id: "preview",
      title: "④ 歩ける、見せられる",
      body: "作った空間はその場でプレビュー。TestPreviewで一人称ウォークスルー、本番プレビューで美しい鑑賞ビュー。クライアント提案もそのまま完結します。",
      hint: "上部バーのプレビューボタン",
      target: { text: "本番プレビュー", tag: "button" },
      waitTarget: true,
    },
    {
      id: "models",
      title: "⑤ 世界中の素材を、空間へ — S.Models",
      body: "家具や建材の3DモデルをS.Modelsで検索。「ソファ」「テーブル」など日本語でも探せて、気に入ったモデルをそのまま空間に配置できます。",
      hint: "S.Models に切り替わりました",
      onEnter: async (a) => { await a.switchTab("3dss"); await a.sleep(700); },
      target: '[data-tour="3dss"]',
      waitTarget: true,
    },
    {
      id: "sites",
      title: "⑥ 成果は、そのまま公開できる",
      body: "あなた専用のアカウントサイト（@you）と、プロジェクト単位の公開サイト。作った成果をワンクリックでポートフォリオとして世界に発信できます。",
      hint: "左のマイページ（アバター）から公開サイトを編集できます",
      target: '[data-tour="my-site"]',
      waitTarget: true,
    },
    {
      id: "start",
      title: "準備はできました",
      body: "あとは触ってみるだけ。各機能の詳しいツアーは、左下の「はじめてガイド」からいつでも見られます。まずはチャットに話しかけてみましょう！",
      target: "#onboarding-checklist-btn",
      waitTarget: true,
    },
  ],
};

// ───────── 深掘りチャプター ─────────

export const CHAPTERS = {
  chat: {
    id: "chat",
    label: "SEKKEIYA Chat を使いこなす",
    steps: [
      {
        id: "chat-input",
        title: "なんでも指示できる入力欄",
        body: "ここに自然言語で指示します。サイト構成の変更、3D生成、ダイアグラム作成、スケジュール管理まで、AIがツールを呼び分けて実行します。",
        onEnter: async (a) => { await a.ensureChatOpen(); },
        target: { placeholder: "何でも" },
        waitTarget: true,
      },
      {
        id: "chat-samples",
        title: "迷ったらサンプル指示から",
        body: "左の履歴パネルにある例文をクリックすれば、そのまま指示を試せます。「ポートフォリオサイトの構成を提案して」などから始めてみましょう。",
        target: { title: "チャット履歴サイドバー" },
      },
      {
        id: "chat-context",
        title: "コンテキスト範囲を切り替える",
        body: "プロジェクト単位／ワークスペース全体など、AIが見る範囲を指定できます。範囲を絞るほど、その文脈に沿った的確な回答になります。",
        target: { text: "Watching Context" },
      },
      {
        id: "chat-cite",
        title: "回答の出典が見える",
        body: "S.Libraryの知識を使った回答には「出典」バッジが付きます。AIが何を根拠にしたかを辿れるので、設計判断に安心して使えます。",
        target: { placeholder: "何でも" },
      },
    ],
  },

  library: {
    id: "library",
    label: "S.Library（脳）に知識を貯める",
    steps: [
      {
        id: "lib-open",
        title: "S.Library を開きます",
        body: "SEKKEIYAの脳。ここに知識を貯めるほどAIが賢くなります。右の「＋」からS.Libraryを開いてみましょう。",
        target: '[data-tour="app-launcher"]',
        waitTarget: true,
      },
      {
        id: "lib-add",
        title: "知識を追加する",
        body: "PDF・書籍・Webページ・メモを取り込めます。AIが自動で要約・分類し、タグやキーポイントを付けて体系化します。",
        target: { text: "知識を追加" },
      },
      {
        id: "lib-rag",
        title: "RAGソースに選ぶ",
        body: "選んだ知識をAIの参照源（RAG）に取り込むと、チャットの回答がその知識に基づくようになります。あなた専用の判断基準が育ちます。",
        target: { text: "RAGソースを選択" },
      },
      {
        id: "lib-category",
        title: "カテゴリで整理",
        body: "法規・構造・意匠・設備・環境・積算・素材などで自動分類。プロジェクトに紐付ければ、スコープ別チャットで文脈が自動適用されます。",
        target: { text: "カテゴリ" },
      },
    ],
  },

  layout: {
    id: "layout",
    label: "S.Layout の自動ツールを全部試す",
    steps: [
      {
        id: "lay-open",
        title: "S.Layout を開きます",
        body: "AIレイアウトの本丸。自動配置からプレビューまで、ここで設計が完結します。",
        onEnter: async (a) => { await a.switchTab("3dsl"); await a.sleep(700); },
        target: '[data-tour="3dsl"]',
        waitTarget: true,
      },
      {
        id: "lay-auto",
        title: "Auto Layout 実行",
        body: "「ルールベース（高速）」と「AIレイアウト」の2モード。部屋寸法・建物タイプ・ゾーン用途を指定して、家具を自動配置します。",
        target: { text: "Auto Layout 実行" },
        waitTarget: true,
      },
      {
        id: "lay-rules",
        title: "レイアウトルール設定",
        body: "セット家具を定義しておくと、Auto Layoutがそれをベースに配置します。自分のルールを学習させるイメージです。",
        target: { text: "レイアウトルール設定" },
      },
      {
        id: "lay-test",
        title: "TestPreview（ウォークスルー）",
        body: "一人称視点で空間を歩けます。カメラを動かしながら、実際の体験として動線や広さを確認できます。",
        target: { text: "TestPreview", tag: "button" },
      },
      {
        id: "lay-prod",
        title: "本番プレビュー",
        body: "躯体＋家具をフルスクリーンの鑑賞ビューでレンダリング。自由に視点を変えられ、そのままクライアント提案に使えます。",
        target: { text: "本番プレビュー", tag: "button" },
      },
    ],
  },

  models: {
    id: "models",
    label: "S.Models でモデルを探して配置",
    steps: [
      {
        id: "mdl-open",
        title: "S.Models を開きます",
        body: "3Dモデルのライブラリ。家具・建材・設備を検索して、空間に配置できます。",
        onEnter: async (a) => { await a.switchTab("3dss"); await a.sleep(700); },
        target: '[data-tour="3dss"]',
        waitTarget: true,
      },
      {
        id: "mdl-scope",
        title: "探す範囲を選ぶ",
        body: "公開モデル（Public）か自分のモデル（Private）かを切り替え。プロジェクトごとにモデルを整理することもできます。",
        target: { text: "Public Models" },
      },
      {
        id: "mdl-search",
        title: "日本語で検索",
        body: "「ソファ」「ローテーブル」などで検索。カテゴリで絞り込み、気になるモデルをダブルクリックで3Dビューアで確認できます。",
        target: { placeholder: "検索" },
      },
      {
        id: "mdl-add",
        title: "空間に配置",
        body: "モデル詳細の「ADD」ボタンで、そのままS.Layoutの空間に追加。お気に入り・ブックマークで自分のライブラリも育てられます。",
        target: '[data-tour="3dss"]',
      },
    ],
  },

  sites: {
    id: "sites",
    label: "サイトを公開してポートフォリオに",
    steps: [
      {
        id: "site-account",
        title: "アカウントサイト（@you）",
        body: "あなたの公開プロフィール兼ポートフォリオ。ヒーロー画像・紹介文・実績（Works）をセクション型で自由に組めます。",
        target: '[data-tour="my-site"]',
        waitTarget: true,
      },
      {
        id: "site-edit",
        title: "編集とプレビュー",
        body: "「編集／プレビュー」を切り替えながらサイトを作成。セクションを追加し、保存すれば下書きが残ります。",
        target: { text: "プレビュー" },
      },
      {
        id: "site-publish",
        title: "公開する",
        body: "「公開」ボタンでユーザー名を決めれば @you で世界に発信。プロジェクト単位のサイトは @you/プロジェクト名 で公開できます。",
        target: { text: "公開" },
      },
    ],
  },
};

export const CHAPTER_LIST = [
  CHAPTERS.chat,
  CHAPTERS.library,
  CHAPTERS.layout,
  CHAPTERS.models,
  CHAPTERS.sites,
];

// ───────── シナリオ（やってみる）─────────
// 実際に SEKKEIYA Chat へタスクを依頼して体験する、易→難の段階的シナリオ。
// 受け入れテスト集としても機能する（Lv1=スモーク, 上位=E2E）。
// v1方針: 依頼文は自動入力／送信はユーザー操作／返答を見て「次へ」で進む半手動。

const LV1_PROMPT = "20畳のカフェの家具レイアウトを提案して";

export const SCENARIOS = {
  s1: {
    id: "s1",
    level: 1,
    label: "Lv.1 ＡＩに単体タスクを依頼する",
    sub: "カフェのレイアウトを1つ頼んでみる",
    steps: [
      {
        id: "s1-intro",
        title: "やってみる Lv.1 — AIに依頼する",
        body: "SEKKEIYAの基本は「やりたいことを言葉にする」だけ。\nここでは試しに、カフェのレイアウトをAIに頼んでみましょう。",
        // 内容に合わせて S.Layout の画面へ遷移しておく
        onEnter: async (a) => { await a.switchTab("3dsl"); await a.sleep(600); },
        target: null,
      },
      {
        id: "s1-fill",
        title: "依頼文を入力しました",
        body: "チャット欄に依頼文を入れました。文章は自由に書き換えてもOKです。次に、これをAIに送ります。",
        hint: "内容を確認したら「次へ」",
        onEnter: async (a) => {
          await a.ensureChatOpen();
          a.typeInto({ placeholder: "何でも" }, LV1_PROMPT, { perChar: 0 });
        },
        target: { placeholder: "何でも" },
        waitTarget: true,
      },
      {
        id: "s1-send",
        title: "送信して、AIに任せる",
        body: "光っている送信ボタン（↑）を押してください。または Enter キーでもOK。\nAIが内容を読み取り、レイアウトの提案を始めます。",
        hint: "送信すると自動で次に進みます",
        action: true,
        pulse: true,
        onEnter: async (a) => { await a.ensureChatOpen(); },
        target: '[data-tour="chat-send"]',
        waitTarget: true,
        // 送信すると入力欄が空になる → それを検知して自動で次へ
        advanceWhen: () => {
          const i = document.querySelector('[placeholder*="何でも"]');
          return !!i && i.value.trim() === "";
        },
      },
      {
        id: "s1-result",
        title: "AIが応えてくれました",
        body: "チャットにAIの提案が表示されましたね。これが基本の使い方です。\n「もっと席数を増やして」「北欧風にして」と続けて頼めば、対話で詰めていけます。",
        hint: "次のレベルでは、もっと複雑な依頼に挑戦できます",
        onEnter: async (a) => { await a.ensureChatOpen(); },
        target: { placeholder: "何でも" },
        waitTarget: true,
      },
    ],
  },
};

export const SCENARIO_LIST = [SCENARIOS.s1];
