import type { Mission } from '../types';
import { ph, rule, tx } from '../helpers';

/**
 * Mission 1 (playable): a wildfire-detection Earth observation CubeSat.
 *
 * SKELETON: the structure is final, the numbers are placeholders. The next step replaces them with
 * values sourced from CubeSat 101, NASA FIRMS, DONKI and GMAT runs (`npm run check:data` lists what is left).
 */
export const wildfireCubesat: Mission = {
  id: 'wildfire-cubesat',
  name: tx('Wildfire Watch CubeSat', '山火事監視キューブサット'),
  summary: tx(
    'Build a small satellite that spots wildfires from low Earth orbit and gets the data to the ground in time.',
    '低軌道から山火事を見つけ、そのデータを間に合ううちに地上へ届ける小型衛星をつくる。',
  ),
  difficulty: 'beginner',
  playable: true,
  budgetKUSD: ph(1500),
  opsDays: ph(365),
  primary: {
    id: 'detect-and-deliver',
    name: tx('Detect and deliver', '検知して届ける'),
    description: tx(
      'Detect active wildfires and deliver the detections to the ground within a day.',
      '活動中の山火事を検知し、1日以内に地上へ届ける。',
    ),
    points: rule(35),
    rule: 'primaryDetectDeliver',
  },
  secondary: [
    {
      id: 'night-fires',
      name: tx('Night-time fires', '夜間の火災'),
      description: tx('Also detect fires at night (needs a thermal infrared camera).', '夜間の火災も検知する（熱赤外カメラが必要）。'),
      points: rule(5),
      rule: 'secondaryNight',
    },
    {
      id: 'fast-alert',
      name: tx('Fast alert', '速報'),
      description: tx('Deliver half of the detections within 3 hours.', '検知の半数を3時間以内に届ける。'),
      points: rule(5),
      rule: 'secondaryFastAlert',
    },
    {
      id: 'long-life',
      name: tx('Long life', '長寿命'),
      description: tx('Keep operating for the full mission length.', 'ミッション期間の最後まで運用を続ける。'),
      points: rule(5),
      rule: 'secondaryLongLife',
    },
  ],
  rubric: { primary: rule(35), secondary: rule(15), science: rule(25), budget: rule(15), schedule: rule(10) },

  slots: [
    // Phase 1: concept
    {
      id: 'secondary', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Secondary objectives', '副目的'),
      help: tx('Each one adds points but also requirements. Agencies chasing the same one split its points.', '1つごとに加点されますが、要求も増えます。同じ副目的を狙う機関が多いと得点が割れます。'),
      options: ['sec-none', 'sec-night', 'sec-fast', 'sec-life'], multi: { min: 0, max: 2 },
    },
    {
      id: 'orbit', phase: 1, role: 'lead', changeKind: 'hardware',
      label: tx('Target orbit', '目標の軌道'),
      help: tx('Decides revisit, ground contact and how long the satellite lasts. Changing it later is expensive.', '観測の頻度、地上局との通信時間、衛星の寿命が決まります。後から変えると高くつきます。'),
      options: ['orbit-iss', 'orbit-sso-500', 'orbit-sso-600'],
    },
    {
      id: 'budget-split', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Budget split', '予算の配分'),
      help: tx('How much to keep in reserve for surprises.', '想定外に備えて、予備費をどれだけ残すか。'),
      options: ['split-balanced', 'split-lean', 'split-safe'],
    },
    // Phase 2: spacecraft design
    {
      id: 'camera', phase: 2, role: 'science', changeKind: 'hardware',
      label: tx('Fire camera', '火災用カメラ'),
      help: tx('What the satellite sees. Thermal infrared sees fires at night too.', '衛星が何を見られるか。熱赤外なら夜の火災も見えます。'),
      options: ['cam-vis', 'cam-swir', 'cam-tir'],
    },
    {
      id: 'power', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Solar arrays', '太陽電池'),
      help: tx('Power for the camera and radio. Deployable arrays give more power but add mass and a failure point.', 'カメラと無線の電力です。展開式は電力が多い分、質量と故障の要因が増えます。'),
      options: ['pwr-body', 'pwr-deploy'],
    },
    {
      id: 'radio', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Radio', '無線機'),
      help: tx('How fast data reaches the ground.', 'データを地上へ送る速さ。'),
      options: ['radio-uhf', 'radio-sband', 'radio-xband'],
    },
    {
      id: 'protection', phase: 2, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Redundancy and radiation protection', '冗長化と放射線対策'),
      help: tx('Spares and shielding make faults survivable but cost mass and money.', '予備や遮へいがあれば故障に耐えられますが、質量と費用がかかります。'),
      options: ['prot-none', 'prot-rad', 'prot-full'], multi: { min: 1, max: 1 },
    },
    // Phase 3: launch
    {
      id: 'launch', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Launch', '打ち上げ'),
      help: tx('Rideshare is cheap but you go where the main payload goes and when it goes.', '相乗りは安い代わりに、主衛星の行き先と日程に従います。'),
      options: ['lv-iss-deploy', 'lv-rideshare', 'lv-dedicated'],
    },
    // Phase 4: test and launch
    {
      id: 'testing', phase: 4, role: 'spacecraft', changeKind: 'plan',
      label: tx('Test campaign', '試験の深さ'),
      help: tx('Deeper testing finds faults before launch but uses time and money.', '試験を厚くすると打ち上げ前に不具合を見つけられますが、時間と費用を使います。'),
      options: ['test-basic', 'test-standard', 'test-full'],
    },
    // Phase 5: operations
    {
      id: 'ops-plan', phase: 5, role: 'science', changeKind: 'plan',
      label: tx('Observation plan', '観測計画'),
      help: tx('Observing more finds more fires but needs more power and downlink.', '多く観測するほど火災を見つけられますが、電力と通信が多く要ります。'),
      options: ['ops-steady', 'ops-aggressive', 'ops-conservative'],
    },
  ],

  options: [
    { kind: 'choice', id: 'sec-none', name: tx('None', 'なし'), description: tx('Focus on the primary objective.', '主目的に集中する。'), cost: ph(0) },
    { kind: 'choice', id: 'sec-night', name: tx('Night-time fires', '夜間の火災'), description: tx('Needs a thermal infrared camera.', '熱赤外カメラが必要。'), cost: ph(0), tags: ['goal:night'] },
    { kind: 'choice', id: 'sec-fast', name: tx('Fast alert', '速報'), description: tx('Needs frequent ground contact.', '地上局との頻繁な通信が必要。'), cost: ph(0), tags: ['goal:fast'] },
    { kind: 'choice', id: 'sec-life', name: tx('Long life', '長寿命'), description: tx('Needs a higher orbit or protection.', '高めの軌道か、対策が必要。'), cost: ph(0), tags: ['goal:life'] },

    { kind: 'orbit', id: 'orbit-iss', name: tx('ISS orbit (about 410 km, 51.6°)', 'ISS軌道（約410 km、51.6°）'), description: tx('Easy to reach; decays within about a year.', '行きやすいが、1年ほどで落ちてくる。'), cost: ph(0), altitudeKm: ph(410), inclinationDeg: ph(51.6), deltaVms: ph(0), contactMinPerDay: ph(30) },
    { kind: 'orbit', id: 'orbit-sso-500', name: tx('Sun-synchronous, 500 km', '太陽同期軌道 500 km'), description: tx('Same local time every pass, global coverage.', '毎回同じ地方時に通過し、全球を見られる。'), cost: ph(0), altitudeKm: ph(500), inclinationDeg: ph(97.4), deltaVms: ph(0), contactMinPerDay: ph(40) },
    { kind: 'orbit', id: 'orbit-sso-600', name: tx('Sun-synchronous, 600 km', '太陽同期軌道 600 km'), description: tx('Lasts longer but must deorbit within 5 years.', '長持ちするが、5年以内に落とす手段が要る。'), cost: ph(0), altitudeKm: ph(600), inclinationDeg: ph(97.8), deltaVms: ph(0), contactMinPerDay: ph(45), tags: ['orbit:high'] },

    { kind: 'choice', id: 'split-balanced', name: tx('Balanced (10% reserve)', '標準（予備費10%）'), description: tx('A typical reserve.', '一般的な予備費。'), cost: ph(0), settings: { reserveShare: rule(0.1) } },
    { kind: 'choice', id: 'split-lean', name: tx('Lean (0% reserve)', '切り詰め（予備費0%）'), description: tx('More money for hardware, none for surprises.', '機器に回せる分は多いが、想定外に弱い。'), cost: ph(0), settings: { reserveShare: rule(0) } },
    { kind: 'choice', id: 'split-safe', name: tx('Safe (25% reserve)', '安全重視（予備費25%）'), description: tx('Survives cuts, less to spend on hardware.', '削減に耐えるが、機器に回せる分が減る。'), cost: ph(0), settings: { reserveShare: rule(0.25) } },

    { kind: 'part', id: 'cam-vis', subsystem: 'payload', name: tx('Visible camera', '可視カメラ'), description: tx('Cheap; sees smoke in daylight only.', '安いが、昼の煙しか見えない。'), cost: ph(60), massKg: ph(0.4), powerW: ph(2), dataMBPerDay: ph(300), scienceWeight: ph(0.5) },
    { kind: 'part', id: 'cam-swir', subsystem: 'payload', name: tx('Short-wave infrared camera', '短波赤外カメラ'), description: tx('Sees active flames through smoke in daylight.', '昼なら煙越しに炎を見られる。'), cost: ph(250), massKg: ph(1.0), powerW: ph(5), dataMBPerDay: ph(500), scienceWeight: ph(1) },
    { kind: 'part', id: 'cam-tir', subsystem: 'payload', name: tx('Thermal infrared camera', '熱赤外カメラ'), description: tx('Sees heat day and night; heavy and power-hungry.', '昼も夜も熱を見られるが、重く電力を食う。'), cost: ph(450), massKg: ph(1.8), powerW: ph(9), dataMBPerDay: ph(700), scienceWeight: ph(1.2), tags: ['night'] },

    { kind: 'part', id: 'pwr-body', subsystem: 'power', name: tx('Body-mounted panels', '機体貼り付けパネル'), description: tx('Simple and reliable, limited power.', '単純で壊れにくいが、電力は少ない。'), cost: ph(40), massKg: ph(0.3), generatesW: ph(8), failPerYear: ph(0.01) },
    { kind: 'part', id: 'pwr-deploy', subsystem: 'power', name: tx('Deployable panels', '展開式パネル'), description: tx('Much more power, one more thing to deploy.', '電力は大きいが、展開という失敗要因が増える。'), cost: ph(120), massKg: ph(0.8), generatesW: ph(25), failPerYear: ph(0.04) },

    { kind: 'part', id: 'radio-uhf', subsystem: 'comms', name: tx('UHF radio', 'UHF無線機'), description: tx('Cheap and simple, very slow.', '安く単純だが、とても遅い。'), cost: ph(15), massKg: ph(0.1), powerW: ph(1), downlinkMBPerMin: ph(0.07) },
    { kind: 'part', id: 'radio-sband', subsystem: 'comms', name: tx('S-band radio', 'Sバンド無線機'), description: tx('A common middle choice.', '標準的な選択。'), cost: ph(60), massKg: ph(0.3), powerW: ph(4), downlinkMBPerMin: ph(15) },
    { kind: 'part', id: 'radio-xband', subsystem: 'comms', name: tx('X-band radio', 'Xバンド無線機'), description: tx('Fast, needs more power and a licence.', '速いが、電力と免許が要る。'), cost: ph(150), massKg: ph(0.4), powerW: ph(10), downlinkMBPerMin: ph(100), leadDays: ph(60) },

    { kind: 'part', id: 'prot-none', subsystem: 'protection', name: tx('None', 'なし'), description: tx('Lightest and cheapest.', '最も軽く安い。'), cost: ph(0), massKg: ph(0) },
    { kind: 'part', id: 'prot-rad', subsystem: 'protection', name: tx('Radiation-tolerant computer', '耐放射線の計算機'), description: tx('Survives most solar storms.', 'たいていの太陽フレアに耐える。'), cost: ph(80), massKg: ph(0.2), tags: ['radHard'] },
    { kind: 'part', id: 'prot-full', subsystem: 'protection', name: tx('Radiation-tolerant computer + spare reaction wheel', '耐放射線の計算機＋予備のホイール'), description: tx('Also keeps pointing if a wheel fails.', 'ホイールが壊れても向きを保てる。'), cost: ph(180), massKg: ph(0.6), tags: ['radHard', 'spareWheel'] },

    { kind: 'launch', id: 'lv-iss-deploy', name: tx('Deploy from the ISS', 'ISSから放出'), description: tx('Cheap; you get the ISS orbit only.', '安いが、ISS軌道にしか行けない。'), cost: ph(120), capacityKg: { 'orbit-iss': ph(12) }, reliability: ph(0.98), windowsDay: ph([120, 240]) },
    { kind: 'launch', id: 'lv-rideshare', name: tx('Rideshare', '相乗り'), description: tx('Shares a rocket going to sun-synchronous orbit.', '太陽同期軌道へ行くロケットに相乗りする。'), cost: ph(300), capacityKg: { 'orbit-sso-500': ph(12), 'orbit-sso-600': ph(12) }, reliability: ph(0.95), windowsDay: ph([150, 300]) },
    { kind: 'launch', id: 'lv-dedicated', name: tx('Dedicated small launcher', '専用の小型ロケット'), description: tx('Your orbit, your date, at a price.', '軌道も日程も選べるが、高い。'), cost: ph(900), capacityKg: { 'orbit-iss': ph(150), 'orbit-sso-500': ph(150), 'orbit-sso-600': ph(130) }, reliability: ph(0.9), windowsDay: ph([90, 180, 270]) },

    { kind: 'choice', id: 'test-basic', name: tx('Basic', '最小限'), description: tx('Functional tests only.', '動作確認のみ。'), cost: ph(20), leadDays: ph(15), settings: { testDepth: rule(1) } },
    { kind: 'choice', id: 'test-standard', name: tx('Standard', '標準'), description: tx('Vibration and thermal vacuum tests.', '振動試験と熱真空試験。'), cost: ph(60), leadDays: ph(30), settings: { testDepth: rule(2) } },
    { kind: 'choice', id: 'test-full', name: tx('Full', '徹底'), description: tx('Adds a full mission rehearsal.', 'ミッション全体の通し試験も行う。'), cost: ph(120), leadDays: ph(50), settings: { testDepth: rule(3) } },

    { kind: 'choice', id: 'ops-steady', name: tx('Steady', '標準'), description: tx('Observe on most passes over land.', '陸上を通るときはたいてい観測する。'), cost: ph(0), settings: { dutyCycle: rule(0.5) } },
    { kind: 'choice', id: 'ops-aggressive', name: tx('Aggressive', '積極的'), description: tx('Observe on every pass; strains power and downlink.', '毎回観測する。電力と通信に負担がかかる。'), cost: ph(0), settings: { dutyCycle: rule(0.9) } },
    { kind: 'choice', id: 'ops-conservative', name: tx('Conservative', '控えめ'), description: tx('Observe fire-season regions only.', '火災の季節の地域だけ観測する。'), cost: ph(0), settings: { dutyCycle: rule(0.25) } },
  ],

  events: [
    {
      id: 'budget-cut', phase: 1, name: tx('Budget cut', '予算の削減'),
      story: tx('The programme budget is cut by 10%.', '計画の予算が10%削減された。'),
      probability: ph(0.3),
      protectedIf: { kind: 'setting', key: 'reserveShare', atLeast: 0.1 },
      unprotected: [{ kind: 'resource', resource: 'budget', delta: -150 }],
      lesson: tx('{agency} had no reserve when the budget was cut.', '{agency}は、予算削減のときに予備費がなかった。'),
    },
    {
      id: 'part-delay', phase: 2, name: tx('Supplier delay', '部品の納期遅延'),
      story: tx('A supplier is late with a key part.', '主要部品の納入が遅れた。'),
      probability: ph(0.35),
      protectedIf: { kind: 'margin', resource: 'schedule', atLeast: 0.15 },
      unprotected: [{ kind: 'delayDays', days: 45 }],
      lesson: tx('{agency} had no schedule margin when a part arrived late.', '{agency}は、部品が遅れたときに日程の余裕がなかった。'),
    },
    {
      id: 'test-anomaly', phase: 4, name: tx('Test anomaly', '試験での不具合'),
      story: tx('A hidden fault is lurking in the spacecraft.', '機体に隠れた不具合がある。'),
      probability: ph(0.4),
      protectedIf: { kind: 'setting', key: 'testDepth', atLeast: 2 },
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.2 }],
      lesson: tx('Light testing let a fault through to orbit for {agency}.', '{agency}は、試験が薄く不具合を軌道まで持ち込んだ。'),
    },
    {
      id: 'launch-failure', phase: 4, name: tx('Launch failure', '打ち上げ失敗'),
      story: tx('The rocket fails to reach orbit.', 'ロケットが軌道に届かなかった。'),
      probability: rule(0, tx('Drawn from the chosen rocket’s reliability instead of a fixed chance.', '一定の確率ではなく、選んだロケットの信頼性から引く。')),
      unprotected: [{ kind: 'missionLost', outcome: 'launchFailure' }],
      lesson: tx('{agency} lost its satellite at launch.', '{agency}は、打ち上げで衛星を失った。'),
    },
    {
      id: 'solar-flare', phase: 5, name: tx('Solar flare', '太陽フレア'),
      story: tx('A strong solar flare hits the spacecraft electronics.', '強い太陽フレアが機体の電子機器を襲った。'),
      probability: ph(0.3),
      protectedIf: { kind: 'hasTag', tag: 'radHard' },
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.5 }],
      lesson: tx('The same flare hit everyone; {agency} had no radiation protection.', '同じフレアが全機関を襲った。{agency}には放射線対策がなかった。'),
    },
    {
      id: 'wheel-failure', phase: 5, name: tx('Reaction wheel failure', 'ホイールの故障'),
      story: tx('A reaction wheel stops spinning.', '姿勢制御のホイールが止まった。'),
      probability: ph(0.15),
      protectedIf: { kind: 'hasTag', tag: 'spareWheel' },
      unprotected: [{ kind: 'scienceFactor', factor: 0.6 }],
      lesson: tx('{agency} lost pointing accuracy without a spare wheel.', '{agency}は、予備のホイールがなく指向精度を失った。'),
    },
    {
      id: 'station-cut', phase: 5, name: tx('Ground station time cut', '地上局の割り当て減'),
      story: tx('Your ground station time is halved for a month.', '地上局の使用時間が1か月半分になった。'),
      probability: ph(0.25),
      protectedIf: { kind: 'margin', resource: 'comms', atLeast: 0.5 },
      unprotected: [{ kind: 'scienceFactor', factor: 0.9 }],
      lesson: tx('{agency} could not downlink everything when station time was cut.', '{agency}は、地上局の時間が減ったときにデータを送りきれなかった。'),
    },
    {
      id: 'big-fire-season', phase: 5, name: tx('Major fire season', '大規模な火災シーズン'),
      story: tx('An intense fire season: a chance for valuable observations.', '火災が多い季節になった。価値ある観測の好機。'),
      probability: ph(0.3),
      unprotected: [],
      readyIf: { kind: 'margin', resource: 'power', atLeast: 0.2 },
      benefit: [{ kind: 'scienceFactor', factor: 1.2 }],
      lesson: tx('{agency} had the power margin to observe the major fire season.', '{agency}は、電力に余裕があり大規模な火災シーズンを観測できた。'),
    },
  ],
};
