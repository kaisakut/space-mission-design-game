// English is the default language: the submission and judging are in English.
export const en = {
  appTitle: 'Space Mission Design Game',
  tagline: 'Design, forecast and fly a mission against rival agencies.',
  langToggle: '日本語',
  start: 'Start',
  comingSoon: 'Under construction during the NASA Space Apps Challenge 2026.',
  close: 'Close',

  // Forecast branch map
  branchMapTitle: 'Forecast branch map',
  branchSplitsHere: 'splits here',
  branchOutcome: 'Outcome',
  branchStart: 'Start',
  branchRuns: '{n} runs',
  branchZoom: 'Click to enlarge',
  branchLegend:
    'Each line is a group of forecast runs that followed the same path. Thicker lines hold more runs; colour shows where they ended up. Lines split at the phase where their status first differed.',

  // Forecast demo (placeholder model)
  demoTitle: 'Forecast preview (placeholder model)',
  demoNote: 'The numbers come from a stand-in model, not from the mission model or NASA data yet.',
  demoRuns: 'Runs',
  demoSeed: 'Seed',
  demoMargin: 'Design margin',
  demoRun: 'Run forecast',
  phaseN: 'Phase {n}',
  state_nominal: 'Nominal',
  state_atRisk: 'At risk',
  state_critical: 'Critical',
  state_lost: 'Lost',
  final_success: 'Full success',
  final_partial: 'Partial success',
  final_failure: 'Failure',
} as const;
