// SEKKEIYA Chat - agentTurn（ステートレスな「1 ターン」tool-calling エンドポイント）
// 仕様: sekkeiya-desktop/docs/10_sekkeiya_chat_spec.md §7.0
//
// 設計:
//   - ループはクライアント主導（Tauri 側 useSekkeiyaAgent）。本関数は 1 往復だけを担う。
//   - ツール実行体（zustand store / fs）はクライアントにしか無いため、本関数は tool_use を返すだけ。
//   - プロンプトキャッシュ: system + tools は安定（cache_control）。揮発する現サイト状態は
//     system に入れず、エージェントが `site_snapshot` ツールで毎ターン取得する → 前置プレフィックス不変。
//
// 入出力（クライアントとの中立フォーマット）:
//   入力  messages: Array<
//            | { role:'user', content: string }
//            | { role:'assistant', text?: string, toolCalls?: Array<{id,name,input}> }
//            | { role:'tool', results: Array<{ tool_use_id, content, is_error? }> }
//          >
//   出力  { stopReason, text, toolCalls: Array<{id,name,input}>, usage }

const Anthropic = require("@anthropic-ai/sdk");

const DEFAULT_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT =
"# ★ ツール使用の絶対ルール（最高優先度・例外なし）\n" +
"以下の操作は**必ずツールを呼んで実行**すること。ツールを呼ばずにテキストだけで「登録しました」「追加しました」と書くことは**禁止**。ツールを呼ばない限りデータは一切保存されない。\n" +
"- スケジュール・予定の追加 → **schedule_create** を呼ぶ（複数件は繰り返し呼ぶ）\n" +
"- タスクの追加 → **task_create** を呼ぶ（複数件は繰り返し呼ぶ）\n" +
"- スケジュールの更新/削除 → schedule_update / schedule_delete を呼ぶ\n" +
"- タスクの更新/削除 → task_update / task_delete を呼ぶ\n" +
"- Google Calendar への追加 → gcal_create_event を呼ぶ\n" +
"- サイトの編集 → add_section / update_section / remove_section 等を呼ぶ\n\n" +
"**NG例（禁止）**: ツールを呼ばず「以下のとおり登録しました」とマークダウン表で回答するだけ。\n" +
"**OK例（正解）**: schedule_create を呼んで実際に登録し、完了後にまとめて報告する。\n\n" +
"また、複数のスケジュール・タスクを作成する場合は **1件ずつ順番に** ツールを呼ぶこと。まとめて1回で複数件を登録するツールは存在しない。\n\n" +
"# ★ 既存データの確認ルール（最高優先度）\n" +
"ユーザーが「タスクを把握して」「現在のスケジュールを確認して」「整理して」「体裁を整えて」等と言ったら：\n" +
"- **必ず** task_list / schedule_list ツールを呼んでリアルタイムのデータを取得すること。\n" +
"- コンテキストに「0件」「なし」と表示されていても、ツールで直接確認すること（コンテキストは参考値）。\n" +
"- ツールで取得したデータを元に作業を進めること。\n\n" +
"# ★ 柔軟な対応ルール\n" +
"「タスクの体裁を整えてスケジュールに入れてください」等の複合依頼には次の手順で対応する：\n" +
"1. task_list で既存タスクを取得して確認・報告する\n" +
"2. schedule_list で既存スケジュールを確認する\n" +
"3. タスクの内容から期限・種別・優先度を整理し task_update で更新する（必要な場合）\n" +
"4. タスクの期限や内容に基づいて schedule_create でスケジュールを作成する\n" +
"5. まとめて報告する\n\n" +
"あなたは SEKKEIYA Chat。建築/インテリアのプロジェクトサイト（ProjectSite）を対話で組み立て・編集するエージェントです。\n" +
"ProjectSite は「1 ページ縦スクロールの section 配列」を複数ページ持つ Web サイトです。\n\n" +
"# 行動原則\n" +
"- 返答・section の本文(body)・タイトルは必ず日本語で書く。\n" +
"- 編集の前に必ず site_snapshot を呼び、現在の構成（ページ/section/本文の有無/sectionId）を把握する。\n" +
"- ユーザーがメッセージに画像を添付した場合は、その画像の内容（建築・空間・参考イメージ・図面など）をよく読み取り、何が写っているかを理解した上で、本文生成やサイト編集の指示に反映する。必要なら何の画像かを簡潔に言及する。\n" +
"- ユーザーの意図を満たすために必要なツールを順に呼び、最後に何をしたかを簡潔に日本語で報告する。\n" +
"- 本文生成では、プロジェクト名や文脈に即した具体的な日本語コピーを書く（プレースホルダ的な空文ではなく）。\n" +
"- 画像等のアセットが必要な場合は gallery_query で実在アセットを取得し、その id を使う。アセットを捏造しない。\n" +
"- gallery_query が返すのは「このプロジェクト固有の自分のアセット」のみ（子アプリの workFiles・AI Drive・S.Layout レンダー）。全ユーザー公開フィード（Gallery）のアセットは含まない。他ユーザーの成果物をサイトに挿入しない。\n" +
"- gallery_query の結果が空の section はプレースホルダのまま残し、「○○ が未作成です。S.Layout で作成しますか？」のように subapp_guide ツールで子アプリへ誘導する。\n" +
"- ユーザーが「ローカルの資料/素材を参照して」「LocalAssets の〜」等と言った場合や、PC ローカルのユーザー素材が役立つ場合は local_assets_list で一覧を取得し、必要なテキスト資料は local_assets_read で内容を読んで本文生成や回答に反映する。これは gallery_query（クラウド成果物）とは別の、ユーザーが自分で置いたローカルファイル群。\n" +
"- 既にユーザーが書いた本文を上書きする場合や、section/ページの削除・サイトの再生成など影響の大きい操作は慎重に行う。\n" +
"- サイトの「公開（deploy）」は行わない（人間の手動ボタンの責務）。\n\n" +
"# 効率\n" +
"- section を追加する際は、gallery_query で対応するアセットが存在すれば即座に add_asset_to_section で紐付ける。\n" +
"- 同時に行える編集はまとめて少ないターンで完了させる。冗長な確認は避ける。\n" +
"- 1 回のユーザー依頼に対し、必要なツール呼び出しを終えたら end_turn で報告する。\n\n" +
"# 長期記憶（AIメモリー）— 能動的に覚える\n" +
"システムプロンプト末尾に『このユーザーについての記憶』『このプロジェクトの記憶』があれば、それが既に覚えている内容です。会話ではそれを踏まえて応答し、**同じ内容を重複して save_memory しない**。\n" +
"ユーザーが『覚えて』と明示しなくても、会話の中で**今後の対話でも踏まえるべき持続的な情報**が出たら、こちらから記憶に残す。判断の目安:\n" +
"- **確信が高い**（本人が自分の考え・好み・作風・恒久的な要望をはっきり述べた／案件の決定・制約が固まった。例『私は必ず自然光を優先する』『予算は◯◯で確定』）→ その場で **save_memory** を呼び、応答の最後に『（〜としてメモリーに覚えておきました）』と一言添える（大げさにしない）。\n" +
"- **迷う程度**（覚える価値はありそうだが、一時的な発言か持続的な方針か判断がつかない）→ 勝手に保存せず、応答の中で**一言たずねる**（例『これは今後の設計方針として覚えておきましょうか？』）。ユーザーが同意したら次ターンで save_memory する。\n" +
"- **覚えない**（今回限りのタスク依頼・一時的な話・雑談・既に記憶済みの内容・ユーザーが単に質問しているだけで自分の立場を述べていないもの）。\n" +
"scope 判定は『別のプロジェクトでも真か？』: Yes=user（人物像・作風・文体）/ No=project（この案件固有の決定・制約）。\n" +
"押しつけない: 1ターンで覚える／たずねるのは**最も重要な1件だけ**。毎回のように確認して会話を妨げない。記憶はあくまで会話の主目的（サイト編集・相談）の邪魔をしない範囲で。\n\n" +
"# 提案書／企画書の自動作成フロー\n" +
"ユーザーが「○○（場所・用途）の提案書（企画書/プレゼン/紹介サイト）を作って」と言ったら、過度に確認せず自律的に最後まで組み立て、最後に要約する。\n" +
"1. site_snapshot で現状確認。提案書構成でなければ create_site_from_template を family='proposal'（集合住宅・分譲なら 'residence'、戸建分譲なら 'parcel'、事務所紹介なら 'studio'）で生成。既存サイトがあれば活かし不足分を add_section で補う。\n" +
"2. 依頼文から『敷地（住所/エリア）・用途・規模・与条件』を抽出し、hero と spec（プロジェクト概要）へ反映（update_section で title/body/specRows）。\n" +
"3. 実務の流れで各 section の body を具体的な日本語で下書きする（空文にしない）。順序の目安: research(敷地・周辺調査／住所があれば mapQuery 設定) → regulation(用途地域/建蔽率/容積率/高さ制限 等を specRows で。断定が危険な数値は『要確認』と明記) → target(想定利用者) → concept(keywords＋ステートメント) → process(検討過程 steps) → zoning/flow(計画方針 callouts) → layout/itemspec/spec(構成・面積・主要仕様) → comparison(案A/B比較)。\n" +
"4. 各 section に合う実在アセットを gallery_query で探し add_asset_to_section で添付。無ければ subapp_guide で該当子アプリ（3dsl=平面/レンダー, 3dsi=パース/画像, 3dsr=図面, 3dsd=ダイアグラム）での作成を案内。\n" +
"5. 用途・トーンに合うスタイルへ set_theme（住宅=journal/atelier/salon、ギャラリー/先鋭=gallery/mono/studio）。必要なら set_motion。『建築スタジオ風に』『ギャラリー風に』等まとまった指定があれば apply_bundle で一括適用してもよい。\n" +
"6. 最後に『作成したページ/section・添付素材・ユーザーが次に手を入れるとよい点（要確認の数値・追加してほしい素材）』を簡潔な箇条書きで報告。\n\n" +
"# S.Blog（ブログ記事）フロー\n" +
"S.Blog の記事は ProjectSite（Webサイト）とは**別物**です。記事の本文は Markdown 1本（bodyMarkdown）で、サイトのような section 配列や画像スロットは持ちません。記事内の『各セクション』とは Markdown 見出し（##）を指します。\n" +
"- ユーザーが**既存記事**に言及（『○○の記事を編集して』『記事を書き直して』『各セクションに画像を入れて』『下書きを直して』等）したら、まず **blog_list** で記事一覧を取得し、対象記事の id を特定する。曖昧なら propose_choices で候補記事を選んでもらう。\n" +
"- 続いて **blog_get** で対象記事の本文(Markdown)全文を読む。\n" +
"- 本文を編集したら **blog_update**（id＋完成形の markdown）で保存する。差分でなく**本文の完成形**を渡すこと。\n" +
"- 本文に画像を入れる場合は、markdown 内に**インライン画像参照** `![説明](URL)` として記述する。URL は捏造せず、ユーザー提供の画像 URL か gallery_query 等で得た実在アセットの URL を使う。素材が無ければ『どの見出しにどんな画像を入れたいか』を確認する。\n" +
"- **会話内容から新規記事を作る**場合のみ create_blog_draft を使う（既存記事の編集には blog_update を使う）。\n" +
"- ブログ記事の編集・画像挿入に、サイト用ツール（add_section / update_section / add_asset_to_section / open_image_picker / start_3d_generation 等）は**使わない**。これらは ProjectSite 専用。3D生成フローへ自動で誘導しない。\n" +
"- システムプロンプトに『[現在の編集対象] ユーザーは S.Blog で記事を編集中』とあれば、そのコンテキストの記事を最優先の対象とみなす。\n\n" +
"# 3Dモデル生成フロー\n" +
"- ユーザーが「3Dモデルを作りたい/生成したい」等と言ったら、まず propose_choices で進め方を提示する（例: choices=[{id:'simage',label:'S.Imageから選ぶ'},{id:'cancel',label:'やめる'}]）。\n" +
"- 「S.Imageから選ぶ」系が選ばれたら open_image_picker({source:'simage', purpose:'3d'}) を呼ぶ。tool_result に選択画像（images:[{id,downloadUrl}], count）が返る。\n" +
"- 画像が確定したら、選択枚数を簡潔に確認し、そのまま start_3d_generation({imageIds:[...選択画像のid]}) を呼ぶ。imageIds には open_image_picker で返った画像の id をそのまま渡す。\n" +
"- start_3d_generation の戻り値に skipped>0 があれば「あと○件は今月の上限により実行できません」と日本語で添える。\n" +
"- start_3d_generation の後は『バックグラウンドで生成を開始しました。完了したものから S.Models に保存されます』と日本語で報告して end_turn する。生成完了をツールで待たない（非ブロッキング）。\n" +
"- propose_choices / open_image_picker は『UIを出してユーザー操作を待つ』ツール。呼んだら同じターンで他のツールを重ねず、ユーザーの操作結果（tool_result）を待つ。\n" +
"- ユーザーが画像選択をキャンセル（tool_result が {cancelled:true}）した場合は、生成を始めず、別の進め方を尋ねるか中断する。\n\n" +
"# 家具選定フロー\n" +
"- ユーザーが「家具を選定して」「プロジェクトに家具を追加して」等と言ったら次の手順で進める。\n" +
"  1. propose_choices でモデルのスコープを聞く（choices: explore=全公開モデル / following=フォロー中ユーザー / my_public=自分の公開 / my_private=自分の非公開）。\n" +
"  2. スコープが確定したら、続けて propose_choices で部屋の用途とスタイルをまとめて一問で聞く（choices に主な候補を並べ、その他自由入力も活用）。\n" +
"  3. furniture_catalog_search で scope・roomType・style を指定して候補を取得する。\n" +
"  4. propose_choices で選定方法を聞く。choices の1番目は必ず {id:'auto', label:'AIにお任せ', description:'AIが最適な家具を自動選定して追加します'} とする。2番目は {id:'manual', label:'S.Modelsで手動選択', description:'S.Modelsを開いてサムネイルを見ながら自分で選びます'}。\n" +
"  5a. 「AIにお任せ（auto）」の場合: 取得した候補から部屋の用途・スタイルに最適なものを AI が選び、すぐ add_furniture_to_project を呼ぶ。選定理由を日本語で報告する。\n" +
"  5b. 「手動選択（manual）」の場合: open_furniture_picker({ candidateIds: [...全候補のid] }) を呼ぶ。S.Models が候補モデルのみを表示して開くので、ユーザーが選択・確定する。tool_result に { selected: string[] } が返ったら add_furniture_to_project を呼ぶ。\n" +
"  6. add_furniture_to_project が完了したら「○点をプロジェクトに追加しました」と日本語で報告する。\n" +
"  7. 続けて propose_choices でサイトへの反映を提案する（choices: [{id:'add_itemspec',label:'アイテムスペックセクションを追加',description:'プロジェクトサイトに選定家具の仕様一覧セクションを作成します'}, {id:'skip',label:'後で'}]）。\n" +
"  8. 「add_itemspec」が選ばれたら add_section(type:'itemspec', title:'家具・仕様一覧') を呼び、追加した家具リストを body に日本語で記述してから update_section で更新する。\n" +
"- furniture_catalog_search の結果が空の場合は「指定のスコープには該当する家具が見つかりませんでした」と伝え、別スコープや条件変更を提案する。\n" +
"- propose_choices / open_furniture_picker は UI を出して待つツールなので、同じターンで他のツールと重ねて呼ばない。\n" +
"- 対象プロジェクト ID はシステムプロンプトの [現在のサイト] projectId= から取得する。projectId が '-' の場合は site_snapshot を呼んで確認する。\n\n" +
"# 自動レイアウトフロー\n" +
"ユーザーが「レイアウトして」「家具を配置して」「○○プロジェクトをレイアウトしてください」等と言ったら：\n" +
"1. **いきなり run_auto_layout を呼ぶ**。事前に「どのレイアウトに配置するか」「部屋の用途」「部屋の広さ（何畳）」を聞いてはいけない。run_auto_layout は (a) いま S.Layout で開いている間取りを自動で対象にし、(b) 部屋の寸法をジオメトリから自動導出し、(c) 配置先を Plan 単位で自動解決し、(d) **配置する家具を S.Models の公開/private/プロジェクトの3Dモデルから自動で選定する**。layout_list / layout_create / furniture_catalog_search / open_furniture_picker を事前に呼ぶ必要は無い。\n" +
"   - 重要: **furniture_catalog_search（索引商品カタログ）は購入用で3Dモデルではないため、レイアウト配置には使わない**。配置に使えるのは S.Models の3Dモデルだけ。\n" +
"2. 返り値に needsSelection:true がある場合のみ、配置先が複数あって特定できない。返ってきた candidates を propose_choices で提示する。**その際 label だけを見せ、ID は絶対に表示しない**。ユーザーが選んだら、その id を planId にして run_auto_layout を再実行する。\n" +
"3. 返り値が noFurniture:true（配置できる3Dモデルが無い）の場合は、手順をフリーテキストで説明して終わらせない。**propose_choices で選択肢ボタンを出す**：choices 例 [{id:'gen3d',label:'カタログ商品から3Dモデルを生成して配置'},{id:'pick',label:'S.Modelsのモデルを選んで使う'},{id:'skip',label:'今回は家具なしで進める'}]。選択に応じて gen3d→furniture_catalog_search で候補を出してから start_3d_generation、pick→open_furniture_picker、を実行する。ID は表示しない。\n" +
"4. 配置できたら「○点の家具を自動配置しました。」と日本語で簡潔に報告して end_turn する。\n" +
"- run_auto_layout は時間のかかる処理のため、他のツールと同時に呼ばない。\n" +
"- どうしても確認が必要なときも、フリーテキストで質問せず propose_choices（選択肢ボタン）を使う。ID は見せない。\n\n" +
"# Google Calendar コネクタフロー\n" +
"Google Calendar が接続されている場合（ユーザーがコネクタ設定で連携済み）、gcal_* ツールが使える。\n\n" +
"## カレンダーの読み取り\n" +
"ユーザーが「カレンダーを確認して」「今月の予定を見せて」「Google Calendar と照合して」等と言ったら gcal_list_events を呼ぶ。\n" +
"- 時期が指定されていれば timeMin/timeMax で絞る（例: 今月 = その月の1日〜末日）。\n" +
"- 結果を日付順にまとめて日本語で報告する。\n\n" +
"## カレンダーへの書き込み\n" +
"- ユーザーが「Google Calendar にも追加して」「カレンダーに登録して」と言ったら gcal_create_event を呼ぶ。\n" +
"- 終日イベント: startDate/endDate（YYYY-MM-DD）を使う。\n" +
"- 時刻付きイベント: startDateTime/endDateTime（ISO 8601 + タイムゾーン +09:00）を使う。\n" +
"- コンペ関係のイベントは colorId: '11'（赤/トマト）が視認性が高い。\n" +
"- 一括登録でも1件ずつ gcal_create_event を呼ぶ。\n\n" +
"## SEKKEIYA スケジュールとの連携\n" +
"- ユーザーが両方への登録を求めた場合: まず SEKKEIYA の schedule_create を呼んでアプリ内に保存し、続けて gcal_create_event で Google Calendar にも追加する。\n" +
"- Google Calendar を読んでから SEKKEIYA のタスクを整理する場合: gcal_list_events → task_list の順で現状を把握してから提案する。\n\n" +
"## Google Calendar が未接続の場合\n" +
"gcal_* ツールが 'Google Calendar が接続されていません' エラーを返した場合は、'設定 > コネクタ から Google Calendar を接続してください' とユーザーに案内する。\n\n" +
"# スケジュール・タスク管理フロー\n" +
"ユーザーが「予定を追加して」「タスクを作って」「スケジュールを整理して」等と言ったら次の手順で進める。\n" +
"対象プロジェクトIDはシステムプロンプトの [現在のサイト] projectId= から取得する。projectId が '-' の場合は site_snapshot を呼んで確認する。\n\n" +
"## 予定（スケジュール）の作成\n" +
"1. 既存の予定を把握するため schedule_list を呼ぶ（初回作成でも空確認として呼ぶ）。\n" +
"2. ユーザーの依頼から日付・タイトル・種別を読み取り、schedule_create を呼ぶ。\n" +
"   - 複数の予定（コンペ締め切り・作業期間・提出日など）は順番に schedule_create を呼んで登録する。\n" +
"   - type の選択: meeting=打合せ/ミーティング, deadline=応募締切・エントリー締切, submission=作品提出・提出締切, other=その他（作業期間開始日など）\n" +
"   - 日付は必ず YYYY-MM-DD 形式で指定する。「6月30日」→「2026-06-30」のように変換する。現在年は 2026 年。\n" +
"3. 全て作成後、登録した予定を日付順にまとめて日本語で報告する。\n\n" +
"## タスクの作成\n" +
"1. task_list で既存タスクを確認する。\n" +
"2. ユーザーの依頼からタイトル・種別・優先度を読み取り、task_create を呼ぶ。\n" +
"   - type の選択: ai=AIが自動実行する作業, manual=ユーザーが自分でやる作業, review=確認・チェック事項\n" +
"   - 複数タスクも順番に task_create で登録する。\n" +
"3. 作成後に登録タスクを優先度順にまとめて報告する。\n\n" +
"## 予定・タスクの更新・削除\n" +
"- 変更前に schedule_list / task_list で現状を確認し、対象のIDを特定してから schedule_update / task_update / schedule_delete / task_delete を呼ぶ。\n" +
"- 「完了にして」→ status:'done', 「進行中に」→ status:'in_progress', 「未着手に戻して」→ status:'todo'（task_update）\n" +
"- 「予定を済みにして」→ status:'done'（schedule_update）\n\n" +
"## 原則\n" +
"- 日付の変換は必ず行う（「7月末」→「2026-07-31」, 「来月」→翌月の末日 など）。\n" +
"- 一括登録でも1件ずつ確実に create を呼ぶ（まとめて1回で複数件を登録するツールはない）。\n" +
"- 登録完了後は必ず一覧で報告する。";

// クライアントの useActionRegistry / ストアにマッピングされるツール群。
// risk は注記（実際の昇降格と承認はクライアント側 §5 で実施）。
const TOOLS = [
  {
    name: "site_snapshot",
    description: "現在の ProjectSite 構成のサマリを取得する（全ページ×section の type/title/body有無/assets件数/sectionId、site未作成なら exists:false）。編集前に必ず最初に呼ぶ。",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "gallery_query",
    description: "当プロジェクトの利用可能アセット（子アプリ成果物）を取得する。section に貼る画像/動画等の id を得るのに使う。",
    input_schema: {
      type: "object",
      properties: {
        sourceApp: { type: "string", description: "絞り込み: 3dss|3dsl|3dsp|3dsc|3dsd|3dsr|3dsi|3dsf（任意）" },
        kind: { type: "string", description: "絞り込み: image|video|pdf|slidedeck|render|embed3d（任意）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_site_from_template",
    description: "テンプレ系統から初回サイトを生成する（site が未作成のとき、または作り直すとき）。既存サイトがある場合は上書きになるため高リスク。",
    input_schema: {
      type: "object",
      properties: {
        family: {
          type: "string",
          enum: ["proposal", "record", "portfolio", "residence", "parcel", "studio"],
          description: "proposal=設計提案プレゼン/record=竣工記録/portfolio=作品集/residence=集合住宅・分譲（部屋一覧・価格・間取り）/parcel=戸建分譲・区画セレクター/studio=事務所・スタジオ紹介",
        },
      },
      required: ["family"],
      additionalProperties: false,
    },
  },
  {
    name: "add_section",
    description: "アクティブページの末尾（または atIndex）に section を追加する。title/body を同時に与えると初期内容を設定できる。",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "hero|overview|concept|layout|presentation|walkthrough|diagram|drawing|gallery|portfolio|spec|research|target|regulation|process|zoning|flow|itemspec|comparison|custom" },
        title: { type: "string", description: "見出し（日本語、任意）" },
        body: { type: "string", description: "本文（日本語、任意）" },
        atIndex: { type: "number", description: "挿入位置（任意、未指定は末尾）" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "update_section",
    description: "既存 section の内容を更新する。title/body/variant を部分更新できる。対象は sectionId で指定（site_snapshot から取得）。",
    input_schema: {
      type: "object",
      properties: {
        sectionId: { type: "string" },
        title: { type: "string", description: "新しい見出し（任意）" },
        body: { type: "string", description: "新しい本文（任意）" },
        variant: { type: "string", description: "誌面レイアウトの型（任意）" },
      },
      required: ["sectionId"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_section",
    description: "section を削除する（中リスク）。対象は sectionId。",
    input_schema: {
      type: "object",
      properties: { sectionId: { type: "string" } },
      required: ["sectionId"],
      additionalProperties: false,
    },
  },
  {
    name: "reorder_sections",
    description: "アクティブページの section 並び順を変更する。orderedIds に新しい順の sectionId 配列を渡す。",
    input_schema: {
      type: "object",
      properties: { orderedIds: { type: "array", items: { type: "string" } } },
      required: ["orderedIds"],
      additionalProperties: false,
    },
  },
  {
    name: "add_asset_to_section",
    description: "section に gallery_query で得たアセット参照を追加する。",
    input_schema: {
      type: "object",
      properties: {
        sectionId: { type: "string" },
        assetId: { type: "string", description: "gallery_query 結果の id" },
      },
      required: ["sectionId", "assetId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_theme",
    description: "サイトのテーマ人格（配色・トーン）を設定する。",
    input_schema: {
      type: "object",
      properties: {
        personality: { type: "string", enum: ["journal", "atelier", "gallery", "salon", "mono", "studio"] },
      },
      required: ["personality"],
      additionalProperties: false,
    },
  },
  {
    name: "set_motion",
    description: "サイト全体のスクロールモーション（動きの強さ）を設定する。建築相応の控えめが既定。ユーザーが『GSAP風に』『動きをつけて』『シネマティックに』等と言ったら使う。",
    input_schema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["still", "subtle", "bold", "cinematic", "experimental", "auto"],
          description: "still=静止 subtle=控えめ bold=大胆 cinematic=シネマティック(強パララックス) experimental=変わり種 auto=スタイル(人格)の既定に従う",
        },
      },
      required: ["mode"],
      additionalProperties: false,
    },
  },
  {
    name: "apply_bundle",
    description: "スタイル＋レイアウト＋モーションをまとめて『おすすめ構成』として一括適用する。ユーザーが『建築スタジオ風に』『ギャラリーのような没入サイトに』等とサイト全体の方向性を指定したときに使う。個別調整は set_theme / set_motion を併用。",
    input_schema: {
      type: "object",
      properties: {
        bundleId: {
          type: "string",
          enum: ["b-architect", "b-gallery", "b-journal", "b-minimal", "b-studio", "b-portfolio"],
          description: "b-architect=建築スタジオ(モノクロ・全幅・シネマ)/b-gallery=ギャラリー(没入3D・大胆)/b-journal=ジャーナル(誌面・サイドバー)/b-minimal=ミニマル(中央・静か)/b-studio=スタジオ(全幅・大胆)/b-portfolio=ポートフォリオ(フルスクリーン・スナップ)",
        },
      },
      required: ["bundleId"],
      additionalProperties: false,
    },
  },
  {
    name: "subapp_guide",
    description: "アセットが存在しない section の補完先として子アプリへ誘導する。ユーザーに「S.Layout でレイアウトを作成しますか？」等と提案し、承諾されたらそのアプリへ遷移する。",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["3dss", "3dsl", "3dsp", "3dsc", "3dsd", "3dsr", "3dsi", "3dsf"], description: "遷移先の子アプリ内部コード" },
        reason: { type: "string", description: "なぜそのアプリへ誘導するかの日本語説明（例: 'レイアウト section に素材がないため S.Layout で作成する必要があります'）" },
      },
      required: ["target", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "local_assets_list",
    description: "ユーザーがローカルに置いた素材（%USERPROFILE%\\SEKKEIYA\\LocalAssets 配下の画像/動画/資料/モデル）の一覧を取得する。category（Images/Movies/Documents/Models 等）や kind で絞り込める。各エントリは relPath/name/kind/category/sizeBytes を持つ。ローカル資料を本文生成・回答の参照に使いたいときに呼ぶ。gallery_query（プロジェクト固有のクラウド成果物）とは別物で、こちらは PC ローカルのユーザー素材。",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "絞り込み: Images|Movies|Documents|Models など LocalAssets 直下のフォルダ名（任意）" },
        kind: { type: "string", description: "絞り込み: image|video|document|model|other（任意）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "local_assets_read",
    description: "LocalAssets 内のテキスト資料（txt/md/csv/json/log/rtf、200KB まで）を読み込んで内容を取得する。relPath は local_assets_list が返した relPath を指定する。PDF・画像・動画・3D モデルなど非テキストは読めない（その場合はエラーを返す）。",
    input_schema: {
      type: "object",
      properties: {
        relPath: { type: "string", description: "local_assets_list が返した relPath（LocalAssets/ からの相対パス）" },
      },
      required: ["relPath"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_choices",
    description: "ユーザーにクリック可能な選択肢を提示する（Claude Code 風の縦並びカード）。これを呼ぶとクライアントは選択肢を描画し、ユーザーの操作を待つ。各選択肢には簡潔な description を付けると親切。クライアントは選択肢の末尾に必ず『その他（自由入力）』欄を自動で追加するので、自由入力用や『その他』の項目を choices に含める必要はない。結果は次ターンの tool_result として返る: 選択肢を選んだ場合は {selected:[id...]}、ユーザーが自由入力した場合は {custom:'入力テキスト'}（複数選択時は {selected:[...], custom:'...'} の併用あり）。custom が来たらユーザーの自由な要望なので柔軟に解釈して対応する。これは「UIを出して待つ」ツールなので、同じターンで他のツールと重ねて呼ばない。",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "選択肢の上に出す日本語の問い（例: '3D化の元画像をどこから選びますか？'）" },
        choices: {
          type: "array",
          description: "提示する選択肢（2〜6個程度）",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "機械可読の選択肢ID（例: 'simage'）" },
              label: { type: "string", description: "ボタン表示の短い日本語" },
              description: { type: "string", description: "補足説明（任意）" },
            },
            required: ["id", "label"],
            additionalProperties: false,
          },
        },
        multiSelect: { type: "boolean", description: "複数選択可なら true（任意・既定 false）" },
      },
      required: ["prompt", "choices"],
      additionalProperties: false,
    },
  },
  {
    name: "open_image_picker",
    description: "S.Image（ソース画像ライブラリ）を複数選択モードで開く。ユーザーが3D化したい画像を最大 max 枚まで選び、確定すると選択画像の一覧（{images:[{id,downloadUrl}], count}）が tool_result として返る。3D生成の元画像を集めるときに使う。これは「UIを出して待つ」ツールなので、同じターンで他のツールと重ねて呼ばない。",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["simage"], description: "現状 'simage' のみ" },
        purpose: { type: "string", description: "用途。3D生成なら '3d'" },
        max: { type: "number", description: "選択上限（任意・既定100）" },
      },
      required: ["source", "purpose"],
      additionalProperties: false,
    },
  },
  {
    name: "start_3d_generation",
    description: "選択済みの画像から3Dモデルのバッチ生成を開始する。非ブロッキングで実行され、各画像が1ジョブになる。今月の残り上限を超える分は自動的に切り捨てて警告する（戻り値の skipped）。imageIds は open_image_picker の結果の画像ID、またはユーザーが明示した画像ID。完了したモデルは自動的に S.Models に保存される。呼んだ後は生成完了をツールで待たず、'バックグラウンドで生成を開始しました。完了したものから S.Models に保存されます' と日本語で報告して end_turn する。",
    input_schema: {
      type: "object",
      properties: {
        imageIds: { type: "array", items: { type: "string" }, description: "3D化する画像のID配列" },
        provider: { type: "string", description: "既定 'tripo3d'" },
      },
      required: ["imageIds"],
      additionalProperties: false,
    },
  },
  // ─── 家具選定フロー ───────────────────────────────────────────────────────
  {
    name: "furniture_catalog_search",
    description: "【3Dモデルをプロジェクト/レイアウトに“配置・追加”する用】S.Models の3Dモデルを検索する。『配置して』『プロジェクトに追加』『レイアウトに入れて』等の配置意図のときに使い、propose_choices で確認後 add_furniture_to_project を呼ぶ。\n※単に家具を『探す/見たい/比較したい/買いたい』だけなら、これではなく catalog_product_search（索引済みの実在商品グリッド）を使うこと。実在商品の方が件数が多く確実にヒットする。",
    input_schema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["explore", "following", "my_public", "my_private"],
          description: "explore=全ユーザー公開モデル following=フォロー中ユーザーの公開 my_public=自分の公開 my_private=自分の非公開",
        },
        roomType: { type: "string", description: "部屋の用途で絞り込む（例: 'LDK', '寝室', 'オフィス'）。任意。" },
        style: { type: "string", description: "デザインスタイルで絞り込む（例: '北欧', 'モダン', 'インダストリアル'）。任意。" },
        maxResults: { type: "number", description: "最大取得件数（任意・既定 30）" },
      },
      required: ["scope"],
      additionalProperties: false,
    },
  },
  {
    name: "open_furniture_picker",
    description: "S.Models を手動ピッカーモードで開く。candidateIds（furniture_catalog_search の結果の id 配列）を渡すと、S.Modelsにその家具だけを絞り込んで表示し、ユーザーが複数選択して「プロジェクトに追加」ボタンを押すと tool_result として { selected: string[] } が返る。キャンセルされた場合は { cancelled: true }。これは「UIを出して待つ」ツールなので同じターンで他のツールと重ねて呼ばない。",
    input_schema: {
      type: "object",
      properties: {
        candidateIds: { type: "array", items: { type: "string" }, description: "furniture_catalog_search が返した id の配列（全件渡してよい）" },
      },
      required: ["candidateIds"],
      additionalProperties: false,
    },
  },
  {
    name: "add_furniture_to_project",
    description: "ユーザーが選定した家具をプロジェクトの S.Models に追加する。重複は自動防止（既存なら更新のみ）。完了後 S.Models が自動で開く。projectId はシステムプロンプトの [現在のサイト] projectId= から取得する。scope/roomType/style/selectionMode は学習ログ用に必ず渡す。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "追加先のプロジェクトID（システムプロンプトの projectId= から取得）" },
        modelIds: { type: "array", items: { type: "string" }, description: "追加する家具の ID 配列（furniture_catalog_search 結果の id）" },
        scope: { type: "string", description: "furniture_catalog_search で使ったスコープ（ログ用）" },
        roomType: { type: "string", description: "部屋タイプ（ログ用）" },
        style: { type: "string", description: "スタイル（ログ用）" },
        selectionMode: { type: "string", enum: ["auto", "manual"], description: "AIお任せ=auto / 手動=manual（ログ用）" },
      },
      required: ["projectId", "modelIds"],
      additionalProperties: false,
    },
  },
  // ─── Google Calendar コネクタ ─────────────────────────────────────────────
  {
    name: "gcal_list_events",
    description: "Google Calendar のイベント一覧を取得する。ユーザーのスケジュールを把握するために使う。Google Calendar が接続されていない場合はエラーが返る。",
    input_schema: {
      type: "object",
      properties: {
        timeMin: { type: "string", description: "取得開始日時 ISO 8601（任意。例: '2026-06-01T00:00:00+09:00'）" },
        timeMax: { type: "string", description: "取得終了日時 ISO 8601（任意。例: '2026-08-31T23:59:59+09:00'）" },
        q: { type: "string", description: "テキスト検索キーワード（任意）" },
        maxResults: { type: "number", description: "最大件数（任意・既定 50）" },
        calendarId: { type: "string", description: "カレンダーID（任意・省略時は primary）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "gcal_create_event",
    description: "Google Calendar にイベントを追加する。SEKKEIYA のスケジュールと連携して Google Calendar にも登録するときに使う。",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "イベントタイトル" },
        description: { type: "string", description: "説明・メモ（任意）" },
        startDateTime: { type: "string", description: "開始日時 ISO 8601（時刻あり例: '2026-07-01T10:00:00+09:00'）" },
        endDateTime: { type: "string", description: "終了日時 ISO 8601（時刻あり例: '2026-07-01T11:00:00+09:00'）" },
        startDate: { type: "string", description: "終日イベントの開始日 YYYY-MM-DD（startDateTime の代わり）" },
        endDate: { type: "string", description: "終日イベントの終了日 YYYY-MM-DD（endDateTime の代わり）" },
        colorId: { type: "string", description: "色 ID（1=薄青 2=緑 3=紫 4=赤 5=黄 6=橙 7=青 8=黒/グレー 9=青緑 10=緑 11=赤/トマト）" },
        location: { type: "string", description: "場所（任意）" },
        calendarId: { type: "string", description: "カレンダーID（任意・省略時は primary）" },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
  {
    name: "gcal_update_event",
    description: "既存の Google Calendar イベントを更新する。eventId は gcal_list_events の結果から取得する。",
    input_schema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "更新するイベントの ID（gcal_list_events の結果から取得）" },
        calendarId: { type: "string", description: "カレンダーID（任意・省略時は primary）" },
        summary: { type: "string", description: "新しいタイトル（任意）" },
        description: { type: "string", description: "新しい説明（任意）" },
        startDateTime: { type: "string", description: "新しい開始日時 ISO 8601（任意）" },
        endDateTime: { type: "string", description: "新しい終了日時 ISO 8601（任意）" },
        startDate: { type: "string", description: "終日イベントの新しい開始日 YYYY-MM-DD（任意）" },
        endDate: { type: "string", description: "終日イベントの新しい終了日 YYYY-MM-DD（任意）" },
        colorId: { type: "string", description: "新しい色 ID（任意）" },
        location: { type: "string", description: "新しい場所（任意）" },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "gcal_delete_event",
    description: "Google Calendar のイベントを削除する。eventId は gcal_list_events の結果から取得する。",
    input_schema: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "削除するイベントの ID" },
        calendarId: { type: "string", description: "カレンダーID（任意・省略時は primary）" },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
  },
  {
    name: "gcal_list_calendars",
    description: "ユーザーの Google Calendar カレンダー一覧を取得する。利用可能なカレンダーの calendarId を確認するときに使う。",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  // ─── スケジュール・タスク管理 ─────────────────────────────────────────────
  {
    name: "schedule_list",
    description: "プロジェクトの予定一覧を取得する。作成・更新・削除の前に必ず呼んで現状を把握すること。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "schedule_create",
    description: "プロジェクトに予定を追加する。コンペ締め切り・打合せ・提出日などを登録するときに使う。複数の予定を作成する場合は順番に呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        title: { type: "string", description: "予定タイトル（日本語可）" },
        dueDate: { type: "string", description: "日付 YYYY-MM-DD 形式" },
        type: {
          type: "string",
          enum: ["meeting", "deadline", "submission", "other"],
          description: "meeting=会議・打合せ / deadline=締め切り / submission=提出 / other=その他（任意・既定 other）",
        },
        startTime: { type: "string", description: "開始時刻 HH:MM（任意）" },
        endTime: { type: "string", description: "終了時刻 HH:MM（任意）" },
        description: { type: "string", description: "詳細・メモ（任意）" },
      },
      required: ["title", "dueDate"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_update",
    description: "既存の予定を更新する。scheduleId は schedule_list の結果から取得する。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        scheduleId: { type: "string", description: "更新する予定のID（schedule_list の結果から取得）" },
        title: { type: "string", description: "新しいタイトル（任意）" },
        dueDate: { type: "string", description: "新しい日付 YYYY-MM-DD（任意）" },
        type: { type: "string", enum: ["meeting", "deadline", "submission", "other"], description: "新しい種別（任意）" },
        startTime: { type: "string", description: "新しい開始時刻 HH:MM（任意）" },
        endTime: { type: "string", description: "新しい終了時刻 HH:MM（任意）" },
        status: { type: "string", enum: ["upcoming", "done"], description: "新しいステータス（任意）" },
        description: { type: "string", description: "新しいメモ（任意）" },
      },
      required: ["scheduleId"],
      additionalProperties: false,
    },
  },
  {
    name: "schedule_delete",
    description: "既存の予定を削除する。scheduleId は schedule_list の結果から取得する。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        scheduleId: { type: "string", description: "削除する予定のID" },
      },
      required: ["scheduleId"],
      additionalProperties: false,
    },
  },
  {
    name: "task_list",
    description: "プロジェクトのタスク一覧を取得する。作成・更新・削除の前に現状を把握するために呼ぶ。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "task_create",
    description: "プロジェクトにタスクを追加する。作業項目・確認事項・AIに依頼したいことを登録するときに使う。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        title: { type: "string", description: "タスクタイトル（日本語可）" },
        type: {
          type: "string",
          enum: ["ai", "manual", "review"],
          description: "ai=AIタスク（自動実行予定） / manual=自分で実行 / review=確認事項（任意・既定 manual）",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "優先度（任意・既定 medium）",
        },
        dueDate: { type: "string", description: "期限 YYYY-MM-DD（任意）" },
        description: { type: "string", description: "詳細・メモ（任意）" },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "task_update",
    description: "既存のタスクを更新する。ステータス変更・内容修正に使う。taskId は task_list の結果から取得する。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        taskId: { type: "string", description: "更新するタスクのID（task_list の結果から取得）" },
        title: { type: "string", description: "新しいタイトル（任意）" },
        type: { type: "string", enum: ["ai", "manual", "review"], description: "新しい種別（任意）" },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "新しい優先度（任意）" },
        status: { type: "string", enum: ["todo", "in_progress", "done"], description: "新しいステータス（任意）" },
        dueDate: { type: "string", description: "新しい期限 YYYY-MM-DD（任意）" },
        description: { type: "string", description: "新しいメモ（任意）" },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "task_delete",
    description: "既存のタスクを削除する。taskId は task_list の結果から取得する。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        taskId: { type: "string", description: "削除するタスクのID" },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  // ─── 自動レイアウトフロー ─────────────────────────────────────────────────
  {
    name: "layout_list",
    description: "プロジェクトの S.Layout に登録されているレイアウト(BasePlan)一覧を取得する。run_auto_layout 前にまず呼んで既存レイアウトを確認し、planId を得る。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "layout_get",
    description: "間取り1件の詳細（家具点数・ゾーン有無・代表サムネ・更新日時）を取得する。layout_list で得た planId を渡す。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        planId: { type: "string", description: "対象プランのID（layout_list の結果から取得）" },
      },
      required: ["planId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_layout_outputs",
    description: "間取りの成果物（レンダー画像・代表サムネ）を取得する。返り値の assetId（例 \"3dsl:<planId>\"）や renders を add_asset_to_section でサイトのギャラリー/レイアウトセクションに添付できる。提案書に間取りのレンダーを載せるときに使う。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        planId: { type: "string", description: "対象プランのID（layout_list の結果から取得）" },
      },
      required: ["planId"],
      additionalProperties: false,
    },
  },
  {
    name: "layout_create",
    description: "S.Layout に BasePlan + Plan を新規作成する。layout_list でレイアウトが存在しない場合のみ呼ぶ。戻り値の planId を run_auto_layout に渡す。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        name: { type: "string", description: "レイアウト名（日本語可、任意・既定「新規レイアウト」）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "render_layout",
    description: "指定した間取りを標準品質で完全ヘッドレス（裏側）でレンダリングし成果物（renders）に保存する。S.Layout を開く必要はなく並行作業でも使える。対象は Plan または Option（家具が入った実体）。layout_list が返すのは Base なので、Base を渡すと内部で配下の Plan/Option を解決する。⚠️返り値に needsSelection:true がある場合は、レンダリング対象（Plan/Option）が複数あって特定できていない。その時は勝手に選ばず、返ってきた candidates（id/label）を propose_choices でユーザーに提示し、選ばれた id を planId にして render_layout を再実行すること。完了後は get_layout_outputs でレンダーを取得し add_asset_to_section でサイトに添付できる。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブ）" },
        planId: { type: "string", description: "レンダリング対象プランのID（layout_list で取得。省略時はいま開いている間取り）" },
        count: { type: "number", description: "生成する枚数（既定3・最大6）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "run_auto_layout",
    description: "間取りにルールベースで家具を自動配置し S.Layout を自動で開く。planId は省略可：いま S.Layout で開いている間取りがあればそれを使う。どの間取りに配置するかをユーザーにフリーテキストで尋ねないこと。部屋の寸法も尋ねない（ジオメトリから自動導出される）。⚠️返り値に needsSelection:true がある場合のみ、返ってきた candidates(id/label) を propose_choices で提示し、選ばれた id を planId にして run_auto_layout を再実行する。完了後は配置件数を日本語で報告し end_turn する。",
    input_schema: {
      type: "object",
      properties: {
        planId: { type: "string", description: "配置先 Plan/Option のID（任意。省略時は開いている間取り→自動解決）" },
        projectId: { type: "string", description: "プロジェクトID（任意、省略時はアクティブプロジェクト）" },
        roomWidthMm: { type: "number", description: "部屋の幅 (mm)。任意。省略時はジオメトリから自動導出。" },
        roomDepthMm: { type: "number", description: "部屋の奥行き (mm)。任意。省略時はジオメトリから自動導出。" },
        buildingType: {
          type: "string",
          enum: ["residential", "cafe", "office", "hotel", "custom"],
          description: "建物タイプ（既定 residential）",
        },
        furnitureSource: {
          type: "string",
          enum: ["project", "following", "public"],
          description: "家具のソース（既定 project=プロジェクト内の登録家具。登録家具がない場合は public を使う）",
        },
      },
      additionalProperties: false,
    },
  },
  // ─── S.Library（知識・カタログ）─────────────────────────────────────────────
  {
    name: "library_list",
    description: "S.Library の既存知識一覧を取得する。重複登録を避けるための確認に使う。",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_knowledge",
    description:
      "S.Library の『外付け脳(RAG)』を検索し、回答の根拠になる文章を取り出す。" +
      "法規・寸法・自社のやり方・過去のブログ記事など、ユーザー自身が蓄積した資料に基づいて答えるべきときに使う。" +
      "category を指定すると該当カテゴリ（例: 法規 / 構造 / 意匠 / 設備 / 環境 / 積算 / 素材・建材 / その他）に絞り込める。" +
      "どのカテゴリか曖昧なときは category を省略して全体検索する。結果(hits)が空、または availableCategories を見て適切なカテゴリで引き直してもよい。" +
      "取得した文章は根拠として使い、使ったら出典(title)を示すこと。資料に無い内容は断定しない。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索したい内容（自然文）" },
        category: { type: "string", description: "絞り込むカテゴリ名（任意）。曖昧なら省略。" },
        topK: { type: "number", description: "取得件数（任意、既定6・最大8）" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "library_save_note",
    description: "調査・要約した内容を Markdown メモとして S.Library に保存する。",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "メモのタイトル" },
        markdown: { type: "string", description: "本文（Markdown）" },
        category: { type: "string", description: "カテゴリ（法規/構造/意匠/設備/環境/積算/素材・建材/その他、任意）" },
        tags: { type: "array", items: { type: "string" }, description: "タグ配列（任意）" },
      },
      required: ["title", "markdown"],
      additionalProperties: false,
    },
  },
  {
    name: "create_blog_draft",
    description:
      "会話の内容をブログ記事の下書きとして S.Blog に作成し、エディタを開く。" +
      "ユーザーが『ここまでの内容を記事にまとめて』『ブログ記事にして』などと依頼したときに使う。" +
      "下書きとして保存するだけで、公開はユーザーがエディタで確認してから行う（このツールで公開はしない）。" +
      "title と markdown（本文）は必須。会話から適切な見出し・本文・抜粋を生成して渡すこと。",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "記事タイトル" },
        markdown: { type: "string", description: "本文（Markdown）。見出しや段落を整えて生成する。" },
        excerpt: { type: "string", description: "抜粋（meta description / OGP 用、120字程度、任意）" },
        category: { type: "string", description: "カテゴリ（お知らせ/設計/インテリア/施工事例/コラム/その他、任意）" },
        tags: { type: "array", items: { type: "string" }, description: "タグ配列（任意）" },
      },
      required: ["title", "markdown"],
      additionalProperties: false,
    },
  },
  {
    name: "blog_list",
    description:
      "S.Blog の既存ブログ記事を一覧取得する（id/タイトル/カテゴリ/状態draft|published/抜粋/本文文字数）。" +
      "ユーザーが『○○の記事を編集して』『記事を直して』『下書きの一覧を見せて』等、既存記事に言及したら、まずこれを呼んで対象記事の id を特定する。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", description: "絞り込み: all|draft|published（任意、既定 all）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "blog_get",
    description:
      "1件のブログ記事の本文(Markdown)全文を取得する。編集の前に現在の本文を読むために使う。" +
      "id を優先し、無ければタイトル部分一致で探す。",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "記事ID（blog_list で取得した id）" },
        title: { type: "string", description: "タイトル（id 不明時の部分一致フォールバック）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "blog_update",
    description:
      "既存ブログ記事の本文/タイトル/抜粋/カテゴリ/タグを更新して保存し、S.Blog エディタで開く。" +
      "ユーザーが『○○の記事を編集して/書き直して/画像を入れて』等と既存記事の変更を求めたときに使う。" +
      "本文に画像を入れる場合は markdown 内にインライン画像参照 ![説明](URL) を記述する。" +
      "公開状態は変更しない（公開はユーザーがエディタで行う）。変更前に blog_get で現在の本文を確認すること。",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "記事ID（blog_list で取得した id、必須に近い）" },
        title: { type: "string", description: "新しいタイトル（任意）" },
        markdown: { type: "string", description: "新しい本文（Markdown 全文。差分でなく完成形を渡す。任意）" },
        excerpt: { type: "string", description: "新しい抜粋（任意）" },
        category: { type: "string", description: "カテゴリ（任意）" },
        tags: { type: "array", items: { type: "string" }, description: "タグ配列（任意）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "library_add_url",
    description: "製品ページ/電子カタログのURLをS.Libraryに登録する（kind=url、HTMLスナップショット付き）。",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "登録するURL" },
        title: { type: "string", description: "ページタイトル（任意）" },
        manufacturer: { type: "string", description: "メーカー名（任意）" },
        category: { type: "string", description: "カテゴリ（例: '素材・建材'、任意）" },
        tags: { type: "array", items: { type: "string" }, description: "タグ配列（任意）" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "library_add_pdf",
    description: "PDFの直リンクURL(.pdf)をダウンロードしてS.Library（ローカル）に保存する。メーカー電子カタログ等の保存に使う。",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "PDFの直リンクURL（.pdf）" },
        title: { type: "string", description: "保存時のタイトル/ファイル名（任意）" },
        fileName: { type: "string", description: "保存時のファイル名（任意、title優先）" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "catalog_product_search",
    description: "索引済みの実在商品（家具・テクスチャ等）をテキストで検索し、結果を商品グリッドとしてチャットに表示する。ユーザーが『ソファを探して』『〜に合う家具は？』『似た商品』等、実在の家具/建材/テクスチャ商品を探す意図のときに使う。表示はツール側で行うので、本文では件数や代表例に簡潔に触れるだけでよい。",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索語（例: 'ソファ 北欧', '一人掛け ファブリック', 'オーク 床材'）" },
        topN: { type: "number", description: "最大表示件数（既定24、最大40）" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "web_list_links",
    description: "指定ページの実在リンク（カタログ/PDFのURL等）を列挙する。捏造せずURL一覧を出すための取得手段。contains（例 'pdf'）で絞り込み可能。JavaScript描画のリンクは取得できない（サーバHTMLのみ）。",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "取得するページのURL" },
        contains: { type: "string", description: "URLに含む文字列で絞り込み（例 'pdf'、任意）" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "research_board_get",
    description:
      "プロジェクトのリサーチボード（Research & Memo の無限キャンバス）の現在のカードとエッジ（接続）の一覧を取得する。ボードに何か置く前・整理する前に必ず呼んで現状を把握すること。返り値: items[]（id / kind: note=付箋・quote=出典付き引用・link・source=S.Library/S.Blog参照・image / role: evidence=根拠・interpretation=解釈・conclusion=結論 / text / refTitle / x,y）と edges[]（id / source→target / relation: supports=だから(根拠が支える)・contradicts=でも(反対)・applies=例えば(一般論を適用)・derives=つまり(結論を導く) / label=接続理由）。ボードは「根拠→解釈→結論」の論証グラフ。エッジのないカード＝まだ論理に組み込まれていない素材と読むこと。ユーザーに説明するときは接続詞（だから/でも/例えば/つまり）で言う。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象プロジェクトID（省略時はアクティブ）" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "research_board_create",
    description:
      "新しいリサーチボードを作成して、そのボードへ切り替える（1つのプロジェクト/個人スコープに複数のボードを持てる）。テーマが大きく変わるとき（例:「意匠の論拠」と「事業性の論拠」を分ける、個人ボードで「キャリアの方向性」と「新規事業アイデア」を分ける）に使う。作成後は以降の add_items / connect_items が新しいボードに置かれる。安易に増やさず、ユーザーの意図が別テーマだと明確なときだけ作る。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象スコープ（省略時は現在表示中のボードのスコープ）。" },
        title: { type: "string", description: "ボード名（例: 事業性の論拠 / 事業アイデア）。" },
      },
      required: ["title"],
    },
  },
  {
    name: "research_board_add_items",
    description:
      "リサーチボードにカードを複数まとめて置く（必要ならエッジも同時に張れる）。対話で言語化した気づき・論点は note、S.Library/S.Blog から得た根拠の一節は quote（refTitle 必須・refId が分かれば付与）で置き、出典に遡れる状態を保つこと。search_knowledge / library_list / blog_get の結果を quote 化するのが根拠づけの基本フロー。論証グラフ上の役割が明確なカードには role を付ける（note の解釈=interpretation・結論=conclusion、quote は evidence）。image の url には gallery_query の thumbnailUrl や blog_get の coverUrl・本文中の画像URLなど https の実URLを使う（data: URL は不可）。x/y を省略すると既存カードに重ならない位置へ自動配置される。関連カードは近い座標を明示して群（クラスタ）にできる。edges の source/target には既存カードの id、または今回 items で追加するカードを \"#0\"（items 配列の添字）で参照できる。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象プロジェクトID（省略時はアクティブ）" },
        items: {
          type: "array",
          description: "置くカードの配列。",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["note", "quote", "link", "source", "image"], description: "note=付箋（言語化した論点・気づき）/ quote=出典付き引用（根拠）/ link=URL / source=S.Library・S.Blogの参照カード / image=画像URL。" },
              text: { type: "string", description: "note の本文 / quote の引用文 / link・image のタイトル。" },
              color: { type: "string", enum: ["yellow", "blue", "pink", "green"], description: "note の色。テーマごとに色を揃えると視認性が上がる。" },
              role: { type: "string", enum: ["evidence", "interpretation", "conclusion"], description: "論証グラフ上の役割。evidence=根拠 / interpretation=解釈（根拠が本PJで何を意味するか）/ conclusion=結論（コンセプト・設計方針）。" },
              url: { type: "string", description: "link・image の URL。" },
              refType: { type: "string", enum: ["library", "article"], description: "quote・source の出典種別（library=S.Library / article=S.Blog）。" },
              refId: { type: "string", description: "出典ID（library: localId / article: 記事ID）。library_list 等で分かる場合は必ず付ける。" },
              refTitle: { type: "string", description: "出典タイトル。quote・source では必須。" },
              refMeta: { type: "string", description: "出典の補足（カテゴリ等）。" },
              x: { type: "number", description: "X座標（省略時は自動配置）。" },
              y: { type: "number", description: "Y座標（省略時は自動配置）。" },
            },
            required: ["kind"],
          },
        },
        edges: {
          type: "array",
          description: "同時に張るエッジ（省略可）。source=根拠側 → target=結論側 の向き。",
          items: {
            type: "object",
            properties: {
              source: { type: "string", description: "始点（根拠・素材側）。既存カード id または \"#0\" 形式で今回の items を添字参照。" },
              target: { type: "string", description: "終点（解釈・結論側）。既存カード id または \"#0\" 形式。" },
              relation: { type: "string", enum: ["supports", "contradicts", "applies", "derives"], description: "supports=だから（根拠が主張を支える）/ contradicts=でも（反対・矛盾）/ applies=例えば（一般論を本PJへ適用）/ derives=つまり（解釈から結論を導く）。" },
              label: { type: "string", description: "接続理由の一行（なぜこの根拠がこの結論を支えるのか）。付けると論証が提案書級になる。" },
            },
            required: ["source", "target", "relation"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "research_board_connect_items",
    description:
      "リサーチボードの既存カード同士を型付きエッジで接続し、「根拠→解釈→結論」の論証の筋道を可視化する。source=根拠側 → target=結論側 の向き。relation は supports=だから（根拠が支える）/ contradicts=でも（採らなかった案・反対根拠も残すと提案の説得力が上がる）/ applies=例えば（一般論・記事の知見を本PJへ）/ derives=つまり（解釈から結論を導く）。label には「なぜ繋がるのか」の一行を必ず入れること——このラベルの積み重ねがそのまま設計根拠の説明になる。カード id は research_board_get で取得。removeEdgeIds で不要になったエッジを外せる。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象プロジェクトID（省略時はアクティブ）" },
        edges: {
          type: "array",
          description: "張るエッジの配列。",
          items: {
            type: "object",
            properties: {
              source: { type: "string", description: "始点カードID（根拠・素材側）。" },
              target: { type: "string", description: "終点カードID（解釈・結論側）。" },
              relation: { type: "string", enum: ["supports", "contradicts", "applies", "derives"], description: "supports=だから / contradicts=でも / applies=例えば / derives=つまり。" },
              label: { type: "string", description: "接続理由の一行（なぜこの根拠がこの結論を支えるのか）。" },
            },
            required: ["source", "target", "relation"],
          },
        },
        removeEdgeIds: { type: "array", items: { type: "string" }, description: "削除するエッジIDの配列（張り替え・整理用）。" },
      },
    },
  },
  {
    name: "research_board_generate_image",
    description:
      "コンセプトイメージ・ムードイメージを AI（AI Render）で生成し、完成したらリサーチボードに画像カードとして自動配置する。言葉で伝わりにくい空気感・素材感・光はこれで見せて、ユーザーの反応からさらに深掘りする。プロンプトには空間の用途・素材・光・時間帯・アングルを具体的に含めること。複数案を出すときは prompts[] に1回の呼び出しでまとめる（最大4枚・並列生成）。同じ呼び出しを連発しない。呼び出しは即時返却され（started が返る）、完成し次第ボードに自動配置される（目安: 約1分）。生成完了を待たずに対話を続けること。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象プロジェクトID（省略時はアクティブ）" },
        prompt: { type: "string", description: "1枚だけ生成する場合のプロンプト（複数枚は prompts を使う）。" },
        caption: { type: "string", description: "prompt 用のキャプション（省略時はプロンプト冒頭）。" },
        prompts: {
          type: "array",
          description: "複数案の一括生成（最大4件・並列）。案出し・比較にはこちらを使う。",
          items: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "生成プロンプト。空間の用途・素材・光・雰囲気を具体的に（日本語可）。" },
              caption: { type: "string", description: "画像カードのキャプション（例:「案A｜余白を設計する住宅」。省略時はプロンプト冒頭）。" },
            },
            required: ["prompt"],
          },
        },
        x: { type: "number", description: "X座標（1枚生成のときのみ。省略時は自動配置）。" },
        y: { type: "number", description: "Y座標（1枚生成のときのみ。省略時は自動配置）。" },
      },
    },
  },
  {
    name: "research_board_update_item",
    description:
      "リサーチボードの既存カード1枚を更新する（本文の推敲・色分け・役割付け・位置の移動＝グルーピング）。id は research_board_get で取得する。ユーザーが書いたカードの本文を書き換えるときは事前に合意を取ること。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象プロジェクトID（省略時はアクティブ）" },
        id: { type: "string", description: "対象カードのID。" },
        text: { type: "string", description: "新しい本文。" },
        color: { type: "string", enum: ["yellow", "blue", "pink", "green"], description: "note の新しい色。" },
        role: { type: "string", enum: ["evidence", "interpretation", "conclusion"], description: "論証グラフ上の役割（evidence=根拠 / interpretation=解釈 / conclusion=結論）。" },
        x: { type: "number", description: "新しいX座標。" },
        y: { type: "number", description: "新しいY座標。" },
      },
      required: ["id"],
    },
  },
  {
    name: "research_board_remove_items",
    description:
      "リサーチボードからカードを削除する（接続されたエッジも一緒に消える）。ユーザーの思考の痕跡を消す操作なので、ユーザーが明確に削除を求めたときだけ使うこと（整理は削除ではなく移動＝update を優先）。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "対象プロジェクトID（省略時はアクティブ）" },
        ids: { type: "array", items: { type: "string" }, description: "削除するカードIDの配列。" },
      },
      required: ["ids"],
    },
  },
  // ─── AIメモリー（長期記憶・docs/21）───────────────────────────────────────
  {
    name: "save_memory",
    description:
      "ユーザーの持続的な情報を長期記憶（AIメモリー）に保存する。ユーザーが『覚えて』『記憶して』『今後は〜して』等と明示したとき、または本人の考え方・好み・案件の重要な決定を今後の対話でも踏まえるべきと判断したときに使う。" +
      "\nscope の判定基準は『別のプロジェクトでも真か？』: " +
      "Yes（人物像・作風・文体・恒久的な要望）→ 'user'。" +
      "No（この案件固有の決定・制約・経緯）→ 'project'。" +
      "\n1回の呼び出しで1件。既に記憶済みと分かっている内容は重複保存しない。一時的なタスクや今この場限りの話は保存しない。" +
      "保存後は『覚えておきます』と一言添えて end_turn する（大げさに説明しない）。",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "記憶する事実（1〜2文・120字以内・日本語）。例:『商業空間では日常の使いやすさを重視する』" },
        scope: { type: "string", enum: ["user", "project"], description: "user=人物像（全プロジェクト共通）/ project=この案件固有" },
        type: {
          type: "string",
          enum: ["opinion", "preference", "profile", "feedback", "decision", "constraint", "context", "direction"],
          description: "user系: opinion(考え方)/preference(好み)/profile(属性)/feedback(AIへの要望)。 project系: decision(決定)/constraint(制約)/context(経緯)/direction(方針)",
        },
      },
      required: ["text", "scope", "type"],
      additionalProperties: false,
    },
  },
  // ─── S.Presentation テンプレート（提案書量産・docs/24）─────────────────────
  // ハンドラはクライアント(VERB_MAP: features/dsp/chat/presentationVerbs.ts)が実行する。
  // ここはモデルが tool_use を出せるようにするスキーマ宣言のみ。
  {
    name: "get_open_presentation",
    description:
      "S.Presentation のエディタで「いま開いているプレゼンテーション」の中身を取得する。" +
      "ユーザーが開いているプレゼンをチャットで編集したいとき、edit_presentation を呼ぶ前に必ずこれで現状を把握する。" +
      "返り値: workFileId / name / canvasSize（width,height）/ pages[]（id・name・要素一覧）。" +
      "各 element は id / type(text|image|shape|…) / x,y,w,h（ピクセル座標）と、text の本文・色・文字サイズ、image の有無、shape の種別などを持つ。" +
      "この element の id を edit_presentation の各 op の elementId に、page の id を pageId に使う。" +
      "プレゼンが開かれていない場合は notOpen:true を返す（その場合はテンプレから apply_presentation_template で作るか、ユーザーに開いてもらう）。",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "edit_presentation",
    description:
      "いま S.Presentation で開いているプレゼンテーションを、指定した編集操作(ops)の配列で書き換える。" +
      "テンプレートのスロットに縛られず、任意の要素・スライドを自由に編集できる（ユーザーの「こう直して」に応える本命ツール）。" +
      "必ず先に get_open_presentation で現在の element/page の id を把握してから呼ぶこと。" +
      "ops は上から順に適用され、変更はエディタに即反映＆undo一回で戻せる。座標(x,y,w,h)は canvasSize 基準のピクセル。" +
      "各 op の種類: " +
      "set_text{elementId,text} テキスト本文を変更 / " +
      "set_style{elementId,color?,fontSize?(px数値),fontWeight?,textAlign?,fill?,opacity?(0-100),bgcolor?} 見た目を変更 / " +
      "set_image{elementId,src(https画像URL),alt?} 画像を差し替え / " +
      "move{elementId,x?,y?,w?,h?,rotation?,opacity?} 位置・サイズ・回転 / " +
      "add_text{pageId?,text,x?,y?,w?,h?,fontSize?,color?,textAlign?,fontWeight?} テキスト追加 / " +
      "add_shape{pageId?,shapeType?(rect|circle),fill?,x?,y?,w?,h?} 図形追加 / " +
      "add_image{pageId?,src,alt?,x?,y?,w?,h?} 画像追加 / " +
      "delete_element{elementId} 要素削除 / " +
      "add_slide{afterPageId?,name?} スライド追加 / delete_slide{pageId} / duplicate_slide{pageId} スライド複製。" +
      "pageId 省略時は先頭スライド。画像URLは https のみ（data: 不可）。",
    input_schema: {
      type: "object",
      properties: {
        ops: {
          type: "array",
          description: "適用する編集操作の配列（上から順に適用）。各要素は op フィールドで種類を指定する。",
          items: {
            type: "object",
            properties: {
              op: {
                type: "string",
                enum: [
                  "set_text", "set_style", "set_image", "move",
                  "add_text", "add_shape", "add_image", "delete_element",
                  "add_slide", "delete_slide", "duplicate_slide",
                ],
                description: "編集操作の種類。",
              },
              elementId: { type: "string", description: "対象要素の id（set_*/move/delete_element）。" },
              pageId: { type: "string", description: "対象/追加先ページの id（add_*/delete_slide/duplicate_slide）。" },
              afterPageId: { type: "string", description: "add_slide でこのページの直後に挿入。" },
              text: { type: "string", description: "set_text / add_text の本文。" },
              src: { type: "string", description: "set_image / add_image の画像URL(https)。" },
              alt: { type: "string", description: "画像の代替テキスト。" },
              color: { type: "string", description: "文字色 #rrggbb。" },
              fill: { type: "string", description: "図形/背景の塗り色。" },
              bgcolor: { type: "string", description: "要素の背景色。" },
              fontSize: { type: "number", description: "文字サイズ（px 数値）。" },
              fontWeight: { type: "string", description: "文字の太さ（400/700 等）。" },
              textAlign: { type: "string", enum: ["left", "center", "right"], description: "文字揃え。" },
              shapeType: { type: "string", enum: ["rect", "circle"], description: "add_shape の図形種別。" },
              name: { type: "string", description: "add_slide のスライド名。" },
              x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
              rotation: { type: "number", description: "回転角（度）。" },
              opacity: { type: "number", description: "不透明度 0–100。" },
            },
            required: ["op"],
          },
        },
      },
      required: ["ops"],
    },
  },
  {
    name: "list_presentation_templates",
    description:
      "S.Presentation のユーザーテンプレート（提案書などの雛形）と、その「差し替え枠(slot)」の一覧を取得する。" +
      "テンプレを使って提案書を作る前に必ず呼び、どのテンプレにどんな差し替え枠があるかを把握すること。" +
      "返り値の templates[] は id / name / description / category / visibility / slideCount と " +
      "slots[]（id=差し替えキー / role=意味づけ / kind: text|image / label=表示名 / placeholder）を持つ。" +
      "この slots の id を apply_presentation_template の slots に使って中身を流し込む。",
    input_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["mine", "public", "all"], description: "取得範囲。mine=自分（既定）/ public=公開テンプレ / all=両方。" },
        category: { type: "string", enum: ["proposal", "list", "report", "portfolio", "other"], description: "カテゴリで絞り込み（任意）。" },
      },
    },
  },
  {
    name: "apply_presentation_template",
    description:
      "指定したテンプレートの差し替え枠に値を流し込んで、新しいプレゼンテーションを生成しエディタで開く。" +
      "まず list_presentation_templates で templateId と slots を確認してから呼ぶこと。" +
      "slots は { 差し替えキー: 値 } のオブジェクト。キーは slot の id（または role）を使う。" +
      "text 枠には文字列、image 枠には画像URL（https。data: URL不可）を渡す。" +
      "空欄・未指定の枠はテンプレートの元の内容を保持する。テンプレのレイアウト・装飾は変更されない。",
    input_schema: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "適用するテンプレートの ID（list_presentation_templates で取得）。" },
        projectId: { type: "string", description: "生成先プロジェクト ID（省略時はアクティブ）。" },
        name: { type: "string", description: "新しいプレゼンテーション名（省略時はテンプレ名＋日付）。" },
        slots: {
          type: "object",
          description: "差し替え枠に流し込む値。{ slotId(またはrole): 値 }。text=文字列 / image=画像URL(https)。省略した枠は元のまま。",
          additionalProperties: { type: "string" },
        },
      },
      required: ["templateId"],
    },
  },
  {
    name: "build_slides_from_layout",
    description:
      "スライド画像（提案書・ポートフォリオ等）を解析したレイアウトから、差し替え枠つきのスライドを生成しエディタで開く。" +
      "ユーザーがスライド画像を添付して「この画像からテンプレートを作って」等と求めたときに使う。" +
      "画像をよく見て、各要素の位置を bbox（スライドに対する割合 0〜1: x,y=左上, w,h=幅高さ）で推定すること。" +
      "写真・作例画像は type=image かつ slot=true（空の差し替え枠にする＝画像自体は取り込まない）。" +
      "タイトルや案件名など可変の文字は type=text・slot=true。見出し/本文のダミー文は text に入れる。" +
      "ロゴ・ページ番号・帯や区切りなどの装飾は slot=false（固定）。type=shape は装飾矩形。" +
      "role には意味（project-title / exterior-photo / body-text 等）、label には日本語表示名（外観写真・案件名 等）を付ける。" +
      "fontScale で文字の大きさの目安（title/heading/body/caption）を示す。1スライドずつが最も正確。",
    input_schema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "生成先プロジェクト ID（省略時はアクティブ）。" },
        name: { type: "string", description: "生成するプレゼン名（省略時は日付）。" },
        canvas: { type: "string", enum: ["16:9", "4:3", "a3", "a4"], description: "スライドの縦横比（既定 16:9）。画像の比率に合わせる。" },
        slides: {
          type: "array",
          description: "生成するスライドの配列（通常は1枚）。",
          items: {
            type: "object",
            properties: {
              elements: {
                type: "array",
                description: "スライド上の要素。奥（背景）→手前の順で並べる。",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["text", "image", "shape"], description: "text=文字 / image=画像枠 / shape=装飾矩形。" },
                    bbox: {
                      type: "object",
                      description: "スライドに対する割合 0〜1。",
                      properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
                      required: ["x", "y", "w", "h"],
                    },
                    text: { type: "string", description: "type=text の文字（ダミー文でよい）。" },
                    role: { type: "string", description: "意味づけ（project-title / exterior-photo / body-text 等）。" },
                    slot: { type: "boolean", description: "差し替え枠にするか。写真枠・可変テキストは true、装飾は false。" },
                    label: { type: "string", description: "slot の表示名（日本語可: 外観写真・案件名 等）。" },
                    align: { type: "string", enum: ["left", "center", "right"], description: "type=text の整列。" },
                    fontScale: { type: "string", enum: ["title", "heading", "body", "caption"], description: "文字サイズの目安。" },
                    fill: { type: "string", description: "type=shape の塗り色（#rrggbb）。" },
                  },
                  required: ["type", "bbox"],
                },
              },
            },
            required: ["elements"],
          },
        },
      },
      required: ["slides"],
    },
  },
];

/** 中立メッセージ履歴 → Anthropic messages へ変換。 */
function toAnthropicMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role === "user") {
      // content が配列なら Anthropic ブロック（text / image）として透過。文字列なら text ブロック化。
      const content = Array.isArray(m.content)
        ? m.content.map((b) => {
            if (b && b.type === "image" && b.source) {
              return {
                type: "image",
                source: { type: "base64", media_type: b.source.media_type, data: b.source.data },
              };
            }
            return { type: "text", text: String((b && b.text) ?? "") };
          })
        : [{ type: "text", text: String(m.content ?? "") }];
      out.push({ role: "user", content });
    } else if (m.role === "assistant") {
      const content = [];
      if (m.text) content.push({ type: "text", text: m.text });
      for (const tc of m.toolCalls || []) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input || {} });
      }
      if (content.length) out.push({ role: "assistant", content });
    } else if (m.role === "tool") {
      out.push({
        role: "user",
        content: (m.results || []).map((r) => ({
          type: "tool_result",
          tool_use_id: r.tool_use_id,
          content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
          ...(r.is_error ? { is_error: true } : {}),
        })),
      });
    }
  }
  return out;
}

exports.agentTurn = async ({ messages, model, memorySection, clientContext }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not defined in the environment.");
  const client = new Anthropic({ apiKey });

  // ツール定義の最後に cache_control を置く → tools 全体をキャッシュ。
  const tools = TOOLS.map((t, i) =>
    i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t
  );

  const anthropicMessages = toAnthropicMessages(messages || []);
  // 🗃 会話履歴のプロンプトキャッシュ。ツールループでは各ステップで履歴が伸び、
  // 従来は messages に cache_control が無く毎回 uncached で全再送していた
  // （コンソールの「キャッシュなし入力」急増・読み取り比率低下の主因）。
  // 最後のメッセージの最後の content ブロックに cache_control を置くと、次リクエストで
  // その手前までの履歴プレフィックス（memory/clientContext が不変ならそれも含む）が
  // キャッシュ読み取りになる。breakpoint は計3個（SYSTEM_PROMPT・tools末尾・履歴末尾 < 上限4）。
  const tail = anthropicMessages[anthropicMessages.length - 1];
  if (tail && Array.isArray(tail.content) && tail.content.length > 0) {
    tail.content[tail.content.length - 1].cache_control = { type: "ephemeral" };
  }

  const resp = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 8000,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      // 🧠 AIメモリー（ユーザー人物像/プロジェクトの記憶。docs/21 Phase A）。
      // ユーザーごとに内容が変わるため、キャッシュ対象の SYSTEM_PROMPT とは
      // 別ブロックで「後置」する（プレフィックスキャッシュを壊さない）
      ...(memorySection ? [{ type: "text", text: memorySection }] : []),
      // 🗂 クライアント文脈（開いているタブのプレイブック・編集対象スナップショット・
      // 日付・RAG抜粋等）。ターンごとに変わるためキャッシュせず最後に後置する。
      // 例: Research & Memo タブ表示中はリサーチボード・プレイブックがここに載る。
      ...(clientContext ? [{ type: "text", text: String(clientContext) }] : []),
    ],
    tools,
    messages: anthropicMessages,
  });

  const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const toolCalls = resp.content
    .filter((b) => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  console.log(`[agentTurn] stop=${resp.stop_reason} tools=${toolCalls.length} ` +
    `in=${resp.usage?.input_tokens} cacheRead=${resp.usage?.cache_read_input_tokens} out=${resp.usage?.output_tokens}`);

  return {
    stopReason: resp.stop_reason,
    text,
    toolCalls,
    usage: {
      inputTokens: resp.usage?.input_tokens,
      outputTokens: resp.usage?.output_tokens,
      cacheReadTokens: resp.usage?.cache_read_input_tokens,
      cacheCreationTokens: resp.usage?.cache_creation_input_tokens,
    },
  };
};

exports.AGENT_TOOLS = TOOLS;
