export interface AiModelMeta {
  overview: {
    purpose: string;
    questions: { icon: string; text: string }[];
    outputFormat: string;
    flow: string;
  };
  engine: {
    baseModel: string;
    switchable: boolean;
    callMethod: string;
    responseFormat: string;
    promptLocation: string;
    avgResponseTime: string;
  };
  cost: {
    monthlyLimit: number;
    estimatedCost: number;
    currentUsage: number;
    billingTiming: string;
  };
  data: {
    baseData: string;
    finetuning: boolean;
    learnsFromHistory: boolean;
    projectDataScope: string;
    externalDestination: string;
  };
  trigger: {
    calledCases: { icon: string; text: string; codePath: string }[];
    notCalledCases: string[];
    dataFlow: string;
  };
}

export const AI_MODEL_METADATA: Record<string, AiModelMeta> = {
  'ai-3dss-recommender:gemini': {
    overview: {
      purpose: '指定されたゾーンの用途・面積・目標人数に基づいて、最適な家具と数量を自動選定します。',
      questions: [
        { icon: '🤔', text: 'このミーティングスペースにはどのような家具が何個必要か？' },
        { icon: '📐', text: 'この広さのカフェゾーンに適切なパッケージはどれか？' }
      ],
      outputFormat: '{\n  "recommendedAssets": [\n    { "id": "ast-xxx", "quantity": 4 }\n  ]\n}',
      flow: 'UI上からの「家具自動配置（Auto Layout）」実行時に、レイアウト計算の直前ステップとして呼び出されます。'
    },
    engine: {
      baseModel: 'gemini-2.5-flash',
      switchable: true,
      callMethod: 'Firebase Cloud Functions (onCall)',
      responseFormat: 'JSON Schema (Function Calling)',
      promptLocation: 'Firebase Functions 側コード内',
      avgResponseTime: '1.2s'
    },
    cost: {
      monthlyLimit: 10000,
      estimatedCost: 15.4,
      currentUsage: 342,
      billingTiming: 'API呼び出しごと（Input/Output Token課金）'
    },
    data: {
      baseData: 'Google提供 Gemini 1.5 Pro 事前学習データ',
      finetuning: false,
      learnsFromHistory: false,
      projectDataScope: '呼び出し時のプロジェクト内登録制アセット一覧のみ',
      externalDestination: 'Google Cloud (Gemini API)'
    },
    trigger: {
      calledCases: [
        { icon: '✨', text: 'Auto Layout アイコンクリック時', codePath: 'recommendFurniture (Cloud Functions)' }
      ],
      notCalledCases: [
        'ユーザーによる手動スナップ配置時',
        'S.Modelsでの個別アセット登録・編集時'
      ],
      dataFlow: 'Client -> functions.httpsCallable("recommendFurniture") -> Gemini API -> Client'
    }
  },
  'ai-layout-coordinator:gemini': {
    overview: {
      purpose: '選定された家具リストとゾーン寸法から、「center」「around」「wall」などのセマンティックな配置ルールを計算します。',
      questions: [
        { icon: '🧩', text: '机の周りに椅子をどう配置するか（around）？' },
        { icon: '🪟', text: '壁沿いに棚をどう並べるか（wall）？' }
      ],
      outputFormat: '{\n  "assets": [...],\n  "relationships": [\n    { "target": "chair", "anchor": "table", "type": "around" }\n  ]\n}',
      flow: '家具レコメンドAIの結果を受け取り、実際の3D空間上へ配置するための座標計算ルールを生成します。'
    },
    engine: {
      baseModel: 'gemini-2.5-flash',
      switchable: true,
      callMethod: 'Firebase Cloud Functions (onCall)',
      responseFormat: 'JSON Schema (Structured Layout Rules)',
      promptLocation: 'Firebase Functions 側コード内',
      avgResponseTime: '1.8s'
    },
    cost: {
      monthlyLimit: 10000,
      estimatedCost: 22.1,
      currentUsage: 342,
      billingTiming: 'API呼び出しごと（Input/Output Token課金）'
    },
    data: {
      baseData: 'Google提供 Gemini 1.5 Pro 事前学習データ',
      finetuning: false,
      learnsFromHistory: false,
      projectDataScope: 'ゾーン形状（BBX）と配置対象アセットリスト',
      externalDestination: 'Google Cloud (Gemini API)'
    },
    trigger: {
      calledCases: [
        { icon: '📏', text: 'Auto Layout 実行時（レコメンド結果取得後）', codePath: 'fetchLayout (Cloud Functions)' }
      ],
      notCalledCases: [
        'ドラッグ＆ドロップによる手作業のレイアウト時'
      ],
      dataFlow: 'Client -> functions.httpsCallable("fetchLayout") -> Gemini API -> JSON Logic -> Client'
    }
  },
  'ai-3dss-classifier:latest': {
    overview: {
      purpose: '3Dモデル（GLB）のファイル名やタグから、カテゴリとサイズを自動で推論・分類する軽量エンジンです。',
      questions: [
        { icon: '🔍', text: 'このモデル(chair_wood_01.glb)の家具カテゴリは何か？' },
        { icon: '📏', text: 'W/D/Hから推測すると「コンパクト椅子」か「ラウンジチェア」か？' }
      ],
      outputFormat: '{\n  "categoryId": "seating",\n  "subCategory": "chair",\n  "confidence": 0.85\n}',
      flow: 'S.Modelsでのモデルアップロード時や、カテゴリ一括再計算時にローカル/ハイブリッドで実行されます。'
    },
    engine: {
      baseModel: 'hybrid-rule-engine',
      switchable: false,
      callMethod: 'ローカル Web Worker + 簡易推論',
      responseFormat: 'JS Object',
      promptLocation: 'AI Studio 内（UIで管理）',
      avgResponseTime: '0.05s'
    },
    cost: {
      monthlyLimit: 0,
      estimatedCost: 0,
      currentUsage: 0,
      billingTiming: 'ローカル処理のため課金なし'
    },
    data: {
      baseData: 'システム組み込みヒューリスティックルール',
      finetuning: true,
      learnsFromHistory: true,
      projectDataScope: 'ワークスペースの全アセット分類メタデータ',
      externalDestination: '外部送信なし（ローカル完結）'
    },
    trigger: {
      calledCases: [
        { icon: '📁', text: 'GLBファイルのアップロード完了時', codePath: 'src/features/dss/upload/util/uploadRoutine.ts' }
      ],
      notCalledCases: [
        '明示的にユーザーが手動でカテゴリを選択した場合'
      ],
      dataFlow: 'Drop -> Extract Bounding Box -> Local Rule Engine Evaluator -> Set Metadata'
    }
  }
};
