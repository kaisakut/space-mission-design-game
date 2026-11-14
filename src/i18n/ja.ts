import type { Messages } from './index';

// 日本語の辞書。キーは en.ts と同じものをすべて持つ（型で抜けを検出する）。
export const ja: Messages = {
  appTitle: '宇宙ミッション設計ゲーム',
  tagline: 'ライバル機関と競いながら、ミッションを設計し、予測し、飛ばそう。',
  langToggle: 'English',
  start: 'はじめる',
  comingSoon: 'NASA Space Apps Challenge 2026 の期間中に開発中です。',
  close: '閉じる',

  branchMapTitle: '予測の分岐図',
  branchSplitsHere: 'ここで分岐',
  branchOutcome: '最終結果',
  branchStart: '出発点',
  branchRuns: '{n} 回',
  branchZoom: 'クリックで拡大',
  branchLegend:
    '1 本の線は、同じ道すじをたどった予測の回のまとまりです。線が太いほど回数が多く、色は行き着いた結果を表します。状態が最初に食い違ったフェーズで線が分かれます。',

  demoTitle: '予測のお試し（仮のモデル）',
  demoNote: '数値は仮のモデルによるもので、まだミッションのモデルや NASA のデータは使っていません。',
  demoRuns: '回数',
  demoSeed: 'シード',
  demoMargin: '設計の余裕',
  demoRun: '予測を回す',
  phaseN: 'フェーズ {n}',
  state_nominal: '順調',
  state_atRisk: '要注意',
  state_critical: '危機的',
  state_lost: '喪失',
  final_success: '完全成功',
  final_partial: '部分的成功',
  final_failure: '失敗',
};
