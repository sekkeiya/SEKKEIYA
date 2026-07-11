/**
 * SEKKEIYA 公式LoRA PoC ハーネス
 * -----------------------------------------------------------------------------
 * 「教師画像キュレーション → fal.ai で LoRA を1本学習 → 1枚生成」を回すための
 * dev 専用 CLI。本番 functions とは独立（デプロイ対象外）。
 *
 * ベース: FLUX.1（本番 airender の flux-schnell と同系）
 *   学習: fal-ai/flux-lora-fast-training  (1回 ~$2, 数分, GPU不要)
 *   推論: fal-ai/flux-lora
 *
 * 前提:
 *   - FAL_KEY を環境変数、または同フォルダの .env.local (gitignore済) に置く。
 *     .env.local 例:  FAL_KEY=xxxxxxxx:yyyyyyyy
 *   ※ このスクリプトはキーを標準出力に出しません。
 *
 * 使い方:
 *   node lora-poc.mjs train interior-perspective
 *   node lora-poc.mjs generate out/interior-perspective-<ts>.lora.json "a bright modern living room, large windows"
 *   node lora-poc.mjs generate <manifest> "<prompt>" --scale 0.9 --steps 28 --size landscape_4_3
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { fal } from "@fal-ai/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASETS_DIR = path.join(__dirname, "datasets");
const OUT_DIR = path.join(__dirname, "out");

const TRAIN_ENDPOINT = "fal-ai/flux-lora-fast-training";
const INFER_ENDPOINT = "fal-ai/flux-lora";
const SEED_ENDPOINT = "fal-ai/flux/schnell";
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// PoC 当座のシード生成用。SEKKEIYAらしい内観パースの作風を固定し、部屋だけ振る。
// ※ FLUX の出力で FLUX 系 LoRA を学習する自家蒸留（規約リスクなし）。本命の教師データは
//   今後 S.Layout / S.Image の自前レンダに差し替える前提の「使い捨てシード」。
const SEED_STYLE =
  "interior architectural visualization, photorealistic render, natural daylight, soft diffused shadows, " +
  "wood and white materials, eye-level wide-angle lens, clean minimal Japanese modern interior, no people";
const SEED_ROOMS = [
  "a bright modern living room with a large sofa and floor-to-ceiling windows",
  "a minimalist bedroom with a low platform bed and morning light",
  "a modern kitchen with a wooden island counter and white cabinets",
  "a dining room with a solid wood table and pendant lights",
  "a home office with a desk by the window and a bookshelf",
  "a genkan entrance hall with wood flooring and shoe storage",
  "a bathroom with a freestanding tub and a large window",
  "an open-plan living-dining space with a high ceiling",
  "a children's room with light wood furniture and soft colors",
  "a reading nook with a window bench and potted plants",
  "a modern tatami room with shoji screens and warm light",
  "a loft living space with exposed structure and large windows",
];

// --- FAL_KEY のロード（平文は出力しない） ------------------------------------
function loadFalKey() {
  if (process.env.FAL_KEY) return process.env.FAL_KEY.trim();
  const envFile = path.join(__dirname, ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*FAL_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  }
  return null;
}

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function ensureKey() {
  const key = loadFalKey();
  if (!key) {
    die(
      "FAL_KEY が見つかりません。\n" +
        "  PowerShell:  $env:FAL_KEY = \"xxxx:yyyy\"   としてから再実行、\n" +
        "  もしくは tools/lora/.env.local に  FAL_KEY=xxxx:yyyy  を1行書いてください（gitignore済）。"
    );
  }
  fal.config({ credentials: key });
}

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function onLog(update) {
  if (update.status === "IN_PROGRESS" && Array.isArray(update.logs)) {
    for (const l of update.logs) if (l?.message) process.stdout.write(`  · ${l.message}\n`);
  }
}

// --- seed (PoC 当座の教師画像を FLUX-schnell で生成) --------------------------
async function seed(datasetName, countArg) {
  if (!datasetName) die("dataset 名を指定してください。例: node lora-poc.mjs seed interior-perspective 12");
  const count = Math.max(1, parseInt(countArg || "12", 10));
  const dsDir = path.join(DATASETS_DIR, datasetName);
  const imgDir = path.join(dsDir, "images");
  fs.mkdirSync(imgDir, { recursive: true });

  const cfgPath = path.join(dsDir, "config.json");
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {};
  const triggerWord = cfg.trigger_word || "skvintr";

  console.log(`\n▸ シード生成 (${SEED_ENDPOINT})  ${count}枚  → ${path.relative(process.cwd(), imgDir)}`);
  console.log(`  作風固定 + 部屋バリエーション。trigger_word="${triggerWord}"（キャプションにも付与）\n`);
  ensureKey();

  let ok = 0;
  for (let i = 0; i < count; i++) {
    const room = SEED_ROOMS[i % SEED_ROOMS.length];
    const prompt = `${room}, ${SEED_STYLE}`;
    process.stdout.write(`  [${i + 1}/${count}] ${room.slice(0, 48)}… `);
    try {
      const result = await fal.subscribe(SEED_ENDPOINT, {
        input: { prompt, image_size: "square_hd", num_images: 1, enable_safety_checker: true },
      });
      const data = result.data || result;
      const url = data?.images?.[0]?.url;
      if (!url) throw new Error("no image url");
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const base = `seed${String(i + 1).padStart(2, "0")}`;
      fs.writeFileSync(path.join(imgDir, `${base}.jpg`), buf);
      // 同名キャプション（trigger_word 先頭）
      fs.writeFileSync(path.join(imgDir, `${base}.txt`), `${triggerWord}, ${room}, ${SEED_STYLE}`);
      ok++;
      console.log("✓");
    } catch (e) {
      console.log(`✗ ${e?.message || e}`);
    }
  }
  console.log(`\n✓ シード生成完了: ${ok}/${count}枚（+同名キャプション）`);
  if (ok >= 4) console.log(`次: node lora-poc.mjs train ${datasetName}`);
  else die("学習に必要な最低枚数(4)に届きませんでした。");
}

// --- train -------------------------------------------------------------------
async function train(datasetName) {
  if (!datasetName) die("dataset 名を指定してください。例: node lora-poc.mjs train interior-perspective");
  const dsDir = path.join(DATASETS_DIR, datasetName);
  const imgDir = path.join(dsDir, "images");
  if (!fs.existsSync(imgDir)) die(`画像フォルダがありません: ${imgDir}`);

  const files = fs.readdirSync(imgDir).filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  if (files.length < 4) die(`教師画像が少なすぎます（${files.length}枚）。最低4枚、推奨15〜30枚を ${imgDir} に置いてください。`);

  // config.json（trigger_word / steps / is_style）
  const cfgPath = path.join(dsDir, "config.json");
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {};
  const triggerWord = cfg.trigger_word || "skvintr";
  const steps = cfg.steps ?? 1000;
  const isStyle = cfg.is_style ?? true;

  // 画像 + 同名 .txt キャプションを zip 化
  const zip = new AdmZip();
  let captioned = 0;
  for (const f of files) {
    zip.addLocalFile(path.join(imgDir, f));
    const txt = path.join(imgDir, path.basename(f, path.extname(f)) + ".txt");
    if (fs.existsSync(txt)) {
      zip.addLocalFile(txt);
      captioned++;
    }
  }
  const zipBuf = zip.toBuffer();

  console.log(`\n▸ dataset "${datasetName}"`);
  console.log(`  画像: ${files.length}枚  / キャプション付き: ${captioned}枚`);
  console.log(`  trigger_word="${triggerWord}"  steps=${steps}  is_style=${isStyle}`);
  console.log(`  zip: ${(zipBuf.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`\n▸ fal storage へアップロード中…`);

  ensureKey();
  const blob = new Blob([zipBuf], { type: "application/zip" });
  blob.name = `${datasetName}.zip`;
  const imagesDataUrl = await fal.storage.upload(blob);

  console.log(`▸ 学習開始 (${TRAIN_ENDPOINT})  ~$2 / 数分…\n`);
  const result = await fal.subscribe(TRAIN_ENDPOINT, {
    input: { images_data_url: imagesDataUrl, trigger_word: triggerWord, steps, is_style: isStyle },
    logs: true,
    onQueueUpdate: onLog,
  });

  const data = result.data || result;
  const loraUrl = data?.diffusers_lora_file?.url;
  if (!loraUrl) die(`学習は完了しましたが LoRA URL が取得できませんでした:\n${JSON.stringify(data, null, 2)}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {
    dataset: datasetName,
    base: "flux",
    trigger_word: triggerWord,
    steps,
    is_style: isStyle,
    images_count: files.length,
    captioned_count: captioned,
    lora_url: loraUrl,
    config_url: data?.config_file?.url || null,
    trained_at: new Date().toISOString(),
    train_endpoint: TRAIN_ENDPOINT,
  };
  const manifestPath = path.join(OUT_DIR, `${datasetName}-${ts()}.lora.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n✓ 学習完了`);
  console.log(`  LoRA URL : ${loraUrl}`);
  console.log(`  manifest : ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`\n次: node lora-poc.mjs generate "${path.relative(process.cwd(), manifestPath)}" "a bright modern living room interior, large windows"`);
}

// --- generate ----------------------------------------------------------------
async function generate(manifestArg, prompt, opts) {
  if (!manifestArg) die("manifest を指定してください。例: node lora-poc.mjs generate out/xxx.lora.json \"...\"");
  if (!prompt) die("プロンプトを指定してください（2番目の引数）。");
  const manifestPath = path.resolve(process.cwd(), manifestArg);
  if (!fs.existsSync(manifestPath)) die(`manifest が見つかりません: ${manifestPath}`);
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!m.lora_url) die("manifest に lora_url がありません。");

  // trigger word をプロンプト先頭に付与（未含有時のみ）
  const finalPrompt =
    m.trigger_word && !prompt.toLowerCase().includes(m.trigger_word.toLowerCase())
      ? `${m.trigger_word}, ${prompt}`
      : prompt;

  console.log(`\n▸ 生成 (${INFER_ENDPOINT})`);
  console.log(`  LoRA   : ${path.basename(manifestPath)}  (scale=${opts.scale})`);
  console.log(`  prompt : ${finalPrompt}\n`);

  ensureKey();
  const result = await fal.subscribe(INFER_ENDPOINT, {
    input: {
      prompt: finalPrompt,
      loras: [{ path: m.lora_url, scale: opts.scale }],
      image_size: opts.size,
      num_inference_steps: opts.steps,
      num_images: 1,
      enable_safety_checker: true,
    },
    logs: true,
    onQueueUpdate: onLog,
  });

  const data = result.data || result;
  const img = data?.images?.[0];
  if (!img?.url) die(`画像が返りませんでした:\n${JSON.stringify(data, null, 2)}`);

  const res = await fetch(img.url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ext = (img.content_type?.split("/")[1] || "png").replace("jpeg", "jpg");
  const outPath = path.join(OUT_DIR, `${m.dataset}-gen-${ts()}.${ext}`);
  fs.writeFileSync(outPath, buf);

  console.log(`\n✓ 生成完了`);
  console.log(`  画像 : ${path.relative(process.cwd(), outPath)}  (seed=${data?.seed ?? "?"})`);
}

// --- CLI ---------------------------------------------------------------------
function parseOpts(args) {
  const o = { scale: 1.0, steps: 28, size: "landscape_4_3" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scale") o.scale = parseFloat(args[++i]);
    else if (args[i] === "--steps") o.steps = parseInt(args[++i], 10);
    else if (args[i] === "--size") o.size = args[++i];
  }
  return o;
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "seed") {
    await seed(rest[0], rest[1]);
  } else if (cmd === "train") {
    await train(rest[0]);
  } else if (cmd === "generate") {
    const positional = rest.filter((a) => !a.startsWith("--"));
    // opts フラグは positional を挟むので rest 全体から解析
    await generate(positional[0], positional[1], parseOpts(rest));
  } else {
    console.log(
      "SEKKEIYA LoRA PoC\n" +
        "  node lora-poc.mjs seed <dataset> [count]      # FLUX-schnellで当座の教師画像を生成\n" +
        "  node lora-poc.mjs train <dataset>\n" +
        '  node lora-poc.mjs generate <manifest.json> "<prompt>" [--scale 1.0] [--steps 28] [--size landscape_4_3]\n'
    );
  }
} catch (e) {
  die(e?.message || String(e));
}
