/**
 * tts — 共通モジュール（src/lib/tts.ts）への re-export。
 * S.Blog 専用だった読み上げを SEKKEIYA Chat と共用化するため本体を昇格した。
 * 既存 import（DsbEditor / SourceArticleReader / BlogAiDialogue）互換のため残す。
 */
export {
  isTtsAvailable, speak, speakSentences, splitSentences,
  stopSpeaking, isSpeaking, pauseSpeaking, resumeSpeaking, isSpeechPaused,
  getTtsSettings, setTtsSettings, listJaVoices, toPlaybackRate,
} from '../../../lib/tts';
export type { TtsSettings, TtsEngine, AiTtsStyle } from '../../../lib/tts';
