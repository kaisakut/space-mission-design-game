import type { Mission } from '../types';
import { est, nasa, pub, rule, tx } from '../helpers';

const DATA_NOTE = tx(
  'Game value for the standard observation plan; the plan you pick scales it.',
  '標準の観測計画でのゲームの値。選んだ観測計画に応じて増減する。',
);
const COMPUTER_MASS_NOTE = tx(
  'NASA’s computer table lists no masses; game value for a single CubeSat computer board.',
  'NASAの計算機の表には質量がないため、CubeSat用計算機1枚分のゲームの値とした。',
);

const CONTACT_NOTE = tx(
  'Minutes per day above 10° elevation from one ground station at 35°N, averaged over 30 days (scripts/orbit-contact.py: circular orbit with J2 drift).',
  '北緯35度の地上局1つから仰角10度以上で見える時間の1日平均（30日間）。scripts/orbit-contact.py（円軌道＋J2の歳差）で計算。',
);
const SSO_NOTE = tx(
  'Inclination at which J2 turns the orbit plane once a year (sun-synchronous), from the standard J2 formula.',
  '地球の扁平（J2）による軌道面の回転が1年で1周になる傾斜角（太陽同期）を、標準のJ2の式で計算。',
);
const FIRMS_NOTE = tx('Real 2024 fire detections under the ground track (NASA FIRMS MODIS); day passes only for day cameras. See data/firms-coverage-2024.json.', '地上軌跡の下にあった2024年の実際の火災検知（NASA FIRMS MODIS）。昼だけのカメラは昼に通ったときだけ数える。data/firms-coverage-2024.json を参照。');
const HIGHLAT_NOTE = tx('Minutes per day above 10° elevation from a second station at 65°N (scripts/orbit-contact.py).', '北緯65度の2つ目の地上局から仰角10度以上で見える時間の1日平均（scripts/orbit-contact.py）。');
const MASS_NOTE = tx('6U × 1.33 kg per U (the CubeSat unit mass in CubeSat 101).', '6U × 1Uあたり1.33 kg（CubeSat 101のCubeSat 1単位の質量）。');

/**
 * Mission 1 (playable): a wildfire-detection Earth observation CubeSat.
 *
 * A 6U CubeSat: thermal infrared imagers for CubeSats fly on 6U platforms (PREFIRE, HyTI).
 * Part values come from NASA's State-of-the-Art Small Spacecraft Technology report and CubeSat 101.
 * Prices are game values (the sources list no prices).
 * The solar storm chance comes from NASA DONKI records (data/donki-sep-2014-2025.json).
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
  budgetKUSD: rule(1500, tx('Game value for a small university-class 6U mission; CubeSat 101 notes there is no standard price.', '大学規模の6Uミッションを想定したゲームの値。CubeSat 101 にも決まった価格はないとある。')),
  opsDays: rule(365),
  bus: {
    massKg: rule(4.0, tx(
      'Game value for a 6U bus without payload (structure, power system, battery, computer, attitude control); an integrated attitude control unit alone is 0.885 kg in NASA’s table.',
      '搭載機器を除く6Uの本体（構体・電源・電池・計算機・姿勢制御）のゲームの値。NASAの表では姿勢制御ユニットだけで0.885 kg。',
    )),
    powerW: rule(4, tx('Game value for the bus electronics and heaters.', '本体の電子機器とヒーターのゲームの値。')),
    cost: rule(400, tx('Game value; the sources list no prices.', 'ゲームの値（資料に価格の記載なし）。')),
    devDays: est(270, ['nasa-cubesat101'], tx('A CubeSat can be designed, built and tested in as little as 9 months (typically 18–24); the game uses the shortest.', 'CubeSatは最短9か月で設計・製造・試験できる（通常18〜24か月）。ゲームでは最短を使う。')),
    maxMassKg: est(8, ['nasa-cubesat101'], MASS_NOTE),
    failPerYear: rule(0.05, tx('Game value for the bus computer and electronics in one year.', '本体の計算機と電子機器が1年で故障する確率のゲームの値。')),
  },
  rules: {
    scienceUnit: tx('fires', '件の火災'),
    budgetFullLeftShare: rule(0.15, tx('Game value, set so that adding one small safeguard to the standard design still earns full budget points.', 'ゲームの値。標準の設計に小さな備えを1つ足しても満点のままになるように決めた。')),
    scienceFullScore: rule(120000, tx('Science value for the full science score; a standard design earns about 20% of it.', '科学価値の満点の基準。標準の設計でその約2割。')),
    earlyFailureByTestDepth: est([0.18, 0.08, 0.04], ['langer-2016', 'nasa-cubesat101'], tx(
      'Chance the satellite never works after launch, by test depth. Basic testing: 18% of 178 CubeSats launched by mid-2014 never made contact (Langer 2016). The values for deeper testing are game values. CubeSat 101 puts verification testing (vibration, thermal vacuum) before every launch.',
      '試験の深さごとの、打ち上げ後に動かない確率。最小限の試験の値：2014年半ばまでに打ち上げたキューブサット178機のうち18%が一度も通信できなかった（Langer 2016）。それより深い試験の値はゲームの値。CubeSat 101 では打ち上げ前の検証試験（振動・熱真空）を必須としている。',
    )),
    changeFactors: rule([1.5, 3, 6], tx('Later changes ripple into more redesign and retesting.', '後で変えるほど、設計のやり直しと再試験が広がる。')),
    changeMinKUSD: rule(30, tx('Redesign work even when the new part costs nothing.', '部品が無料でも、設計のやり直しに費用がかかる。')),
    changeDelayDaysPerPhase: rule(15),
  },
  // Picture only: latitudes are those used for the contact minutes (35° N own, 65° N high latitude);
  // longitudes and the network sites are display values.
  view: {
    kind: 'earthOrbit',
    stations: {
      own: { lat: 35, lon: 139 },
      highLat: { lat: 65, lon: 25 },
      network: [{ lat: 64, lon: -147 }, { lat: -33, lon: 18 }, { lat: 13, lon: 77 }, { lat: -45, lon: 169 }, { lat: 78, lon: 15 }, { lat: 37, lon: -122 }],
    },
    wings: ['pwr-deploy'],
    fires: true,
  },
  primary: {
    id: 'detect-and-deliver',
    name: tx('Detect and deliver', '検知して届ける'),
    description: tx(
      'Detect active wildfires and deliver the detections to the ground.',
      '活動中の山火事を検知し、その結果を地上へ届ける。',
    ),
    points: rule(35),
    rule: { kind: 'science', atLeast: 20000, partialAtLeast: 2000 },
  },
  secondary: [
    {
      id: 'night-fires',
      name: tx('Night-time fires', '夜間の火災'),
      description: tx('Also detect fires at night (needs a thermal infrared camera).', '夜間の火災も検知する（熱赤外カメラが必要）。'),
      points: rule(5),
      rule: { kind: 'hasTag', tag: 'night' },
      chosenBy: 'goal:night',
    },
    {
      id: 'fast-alert',
      name: tx('Fast alert', '速報'),
      description: tx('Alert within minutes of a detection: a station in view on almost every orbit (a commercial network) and radio capacity at least twice the data made each day.', '検知から数分で知らせる。ほぼ毎周回見える地上局（商用の局網）と、1日に作るデータの2倍以上を送れる余裕が必要。'),
      points: rule(5),
      // A satellite can only send what it saw when it passes a station: fast alerts need stations all around the world.
      rule: { kind: 'all', of: [{ kind: 'hasTag', tag: 'frequentContact' }, { kind: 'margin', resource: 'downlink', atLeast: 0.5 }] },
      chosenBy: 'goal:fast',
    },
    {
      id: 'long-life',
      name: tx('Long life', '長寿命'),
      description: tx('Keep operating for the full mission length.', 'ミッション期間の最後まで運用を続ける。'),
      points: rule(5),
      rule: { kind: 'survive' },
      chosenBy: 'goal:life',
    },
  ],
  rubric: { primary: rule(35), secondary: rule(15), science: rule(30), budget: rule(10), schedule: rule(10) },

  slots: [
    // Phase 1: concept
    {
      id: 'secondary', icon: 'target', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Secondary objectives', '副目的'),
      help: tx('Each one adds points but also requirements. Agencies chasing the same one split its points.', '1つごとに加点されますが、要求も増えます。同じ副目的を狙う機関が多いと得点が割れます。'),
      options: ['sec-none', 'sec-night', 'sec-fast', 'sec-life'], multi: { min: 0, max: 2, noneFirst: true },
    },
    {
      id: 'orbit', icon: 'globe', default: 'orbit-sso-500', phase: 1, role: 'lead', changeKind: 'hardware',
      label: tx('Target orbit', '目標の軌道'),
      help: tx('Decides what you can observe and how long you can talk to the ground. Changing it later is expensive.', '観測できる量と、地上局と通信できる時間が決まります。後から変えると高くつきます。'),
      options: ['orbit-iss', 'orbit-sso-500', 'orbit-sso-600'],
    },
    {
      id: 'budget-split', icon: 'coins', level: { by: 'settings.reserveShare', label: tx('Reserve', '予備費') }, phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Budget split', '予算の配分'),
      help: tx('How much to keep in reserve for surprises.', '想定外に備えて、予備費をどれだけ残すか。'),
      options: ['split-balanced', 'split-lean', 'split-safe'],
    },
    // Phase 2: spacecraft design
    {
      id: 'camera', icon: 'eye', default: 'cam-swir', phase: 2, role: 'science', changeKind: 'hardware',
      label: tx('Fire camera', '火災用カメラ'),
      help: tx('What the satellite sees. Thermal infrared sees fires at night too.', '衛星が何を見られるか。熱赤外なら夜の火災も見えます。'),
      options: ['cam-vis', 'cam-swir', 'cam-tir'],
    },
    {
      id: 'power', icon: 'panel', level: { by: 'generatesW+rtgW', label: tx('Power', '発電') }, phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Solar arrays', '太陽電池'),
      help: tx('Power for the camera and radio. Deployable arrays give more power but add mass and a failure point.', 'カメラと無線の電力です。展開式は電力が多い分、質量と故障の要因が増えます。'),
      options: ['pwr-body', 'pwr-deploy'],
    },
    {
      id: 'radio', icon: 'antenna', level: { by: 'downlinkMBPerMin', label: tx('Speed', '速さ') }, default: 'radio-sband', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Radio', '無線機'),
      help: tx('How fast data reaches the ground.', 'データを地上へ送る速さ。'),
      options: ['radio-sband', 'radio-xband'],
    },
    {
      id: 'protection', icon: 'shield', level: { by: 'tags', label: tx('Protection', '防護') }, phase: 2, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Redundancy and radiation protection', '冗長化と放射線対策'),
      help: tx('Spares and shielding make faults survivable but cost mass and money.', '予備や遮へいがあれば故障に耐えられますが、質量と費用がかかります。'),
      options: ['prot-none', 'prot-rad', 'prot-full'],
    },
    // Phase 3: launch
    {
      id: 'launch', icon: 'rocket', default: 'lv-rideshare', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Launch', '打ち上げ'),
      help: tx('The launch must reach the orbit you chose in phase 1.', 'フェーズ1で選んだ軌道に行ける打ち上げでなければなりません。'),
      options: ['lv-iss-deploy', 'lv-rideshare'],
    },
    {
      id: 'window', icon: 'calendar', level: { by: 'settings.targetWindow', label: tx('Time in hand', '余裕') }, default: 'window-first', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Rideshare flight', '打ち上げの便'),
      help: tx('CubeSats ride on rockets that fly on set dates; the dates depend on the launch you chose. Take the first flight for the best schedule score, or book the next one to keep time in hand.', 'キューブサットは、決まった日に飛ぶロケットの便に乗ります。便の日は、選んだ打ち上げ方法で決まります。最初の便なら日程の点が高く、次の便を予約すれば時間に余裕ができます。'),
      options: ['window-first', 'window-second'],
    },
    {
      id: 'ground', icon: 'dish', level: { by: 'settings.networkFactor+settings.highLatStation', label: tx('Contact', '通信') }, default: 'gs-own', phase: 3, role: 'powerComms', changeKind: 'plan',
      label: tx('Ground stations', '地上局'),
      help: tx('More stations mean more contact time, so more of your data gets down.', '局が多いほど通信時間が増え、より多くのデータを降ろせます。'),
      options: ['gs-own', 'gs-highlat', 'gs-network'],
    },
    // Phase 4: test and readiness
    {
      id: 'testing', icon: 'clipboard', level: { by: 'settings.testDepth', label: tx('Depth', '深さ') }, default: 'test-basic', phase: 4, role: 'spacecraft', changeKind: 'plan',
      label: tx('Test campaign', '試験の深さ'),
      help: tx('Deeper testing finds faults before launch but uses time and money.', '試験を厚くすると打ち上げ前に不具合を見つけられますが、時間と費用を使います。'),
      options: ['test-basic', 'test-standard', 'test-full'],
    },
    {
      id: 'ops-prep', icon: 'headset', level: { by: 'costed', label: tx('Preparation', '準備') }, default: 'prep-minimal', phase: 4, role: 'lead', changeKind: 'plan',
      label: tx('Operations readiness', '運用の準備'),
      help: tx('Rehearse the first days in orbit with the ground station before launch.', '打ち上げ前に、地上局と一緒に軌道上の最初の数日を通しで練習します。'),
      options: ['prep-minimal', 'prep-rehearsal'],
    },
    {
      id: 'model', icon: 'box', level: { by: 'costed', label: tx('Preparation', '準備') }, default: 'em-none', phase: 4, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Engineering model', '試験用の予備機'),
      help: tx('A second unit for testing lets you find and fix faults without risking the flight unit.', '試験専用の2台目があれば、本番の機体を傷めずに不具合を探して直せます。'),
      options: ['em-none', 'em-build'],
    },
    // Phase 5: launch and operations
    {
      id: 'ops-plan', icon: 'eye', level: { by: 'settings.dutyCycle', label: tx('Observing', '観測'), style: 'arc' }, default: 'ops-conservative', phase: 5, role: 'science', changeKind: 'plan',
      label: tx('Observation plan', '観測計画'),
      help: tx('Observing more finds more fires but needs more power and downlink.', '多く観測するほど火災を見つけられますが、電力と通信が多く要ります。'),
      options: ['ops-steady', 'ops-aggressive', 'ops-conservative'],
    },
  ],

  options: [
    { kind: 'choice', id: 'sec-none', icon: 'none', name: tx('None', 'なし'), description: tx('Focus on the primary objective.', '主目的に集中する。'), cost: rule(0) },
    { kind: 'choice', id: 'sec-night', icon: 'moon', name: tx('Night-time fires', '夜間の火災'), description: tx('Needs a thermal infrared camera.', '熱赤外カメラが必要。'), cost: rule(0), tags: ['goal:night'] },
    { kind: 'choice', id: 'sec-fast', icon: 'bolt', name: tx('Fast alert', '速報'), description: tx('Needs frequent ground contact.', '地上局との頻繁な通信が必要。'), cost: rule(0), tags: ['goal:fast'] },
    { kind: 'choice', id: 'sec-life', icon: 'hourglass', name: tx('Long life', '長寿命'), description: tx('Keep working to the end of the mission; protection against failures helps.', 'ミッションの最後まで動き続ける必要がある。故障への備えが効く。'), cost: rule(0), tags: ['goal:life'] },

    {
      kind: 'orbit', id: 'orbit-iss', icon: 'orbit', name: tx('ISS orbit (about 410 km, 51.6°)', 'ISS軌道（約410 km、51.6°）'),
      description: tx('Deployed from the Space Station. Never passes over the polar regions.', '宇宙ステーションから放出される。北極・南極の近くは通らない。'),
      cost: rule(0),
      altitudeKm: est(410, ['nasa-soa-launch'], tx('Middle of the 400–420 km deployment orbit given for ISS CubeSat deployment.', 'ISSからの放出軌道 400〜420 km の中央。')),
      inclinationDeg: nasa(51.6, ['nasa-soa-launch']),
      contactMinPerDay: est(21, ['nasa-orbits-catalog'], CONTACT_NOTE),
      contactHighLatMinPerDay: est(0, ['nasa-orbits-catalog'], HIGHLAT_NOTE),
      science: { day: est(198436, ['nasa-firms'], FIRMS_NOTE), dayNight: est(387362, ['nasa-firms'], FIRMS_NOTE) },
    },
    {
      kind: 'orbit', id: 'orbit-sso-500', icon: 'orbit', name: tx('Sun-synchronous, 500 km', '太陽同期軌道 500 km'),
      description: tx('Passes over each place at the same local time, and covers the whole globe.', '毎回同じ地方時に通過し、全球を見られる。'),
      cost: rule(0),
      altitudeKm: rule(500, tx('Design choice offered to the player.', 'プレイヤーに示す設計の選択肢。')),
      inclinationDeg: est(97.4, ['nasa-orbits-catalog'], SSO_NOTE),
      contactMinPerDay: est(17, ['nasa-orbits-catalog'], CONTACT_NOTE),
      contactHighLatMinPerDay: est(37, ['nasa-orbits-catalog'], HIGHLAT_NOTE),
      science: { day: est(158040, ['nasa-firms'], FIRMS_NOTE), dayNight: est(304111, ['nasa-firms'], FIRMS_NOTE) },
    },
    {
      kind: 'orbit', id: 'orbit-sso-600', icon: 'orbit', name: tx('Sun-synchronous, 600 km', '太陽同期軌道 600 km'),
      description: tx('Higher: longer passes over each ground station and less air drag in solar storms, but needs a device to come down at the end.', '高い分、地上局の上を通る時間が長く、磁気嵐で大気の抵抗も受けにくい。ただし最後に降ろす装置が要る。'),
      cost: rule(40, tx('Game value for buying, fitting and testing a drag sail. The US FCC requires disposal within 5 years of mission end; from 600 km a CubeSat takes far longer on its own. No public price was found, so the cost stays modest.', '抵抗帆の購入・取り付け・試験のゲームの値。米国FCCはミッション終了から5年以内の処分を求めており、600 kmからでは自然に落ちるまでずっと長くかかる。公開された価格は見つからなかったため、費用は控えめにした。')),
      addsMassKg: pub(0.21, ['npc-artica'], tx('A commercial CubeSat drag sail (210 g) that brings a satellite down from 650 km in under 5 years.', '市販のCubeSat用抵抗帆（210 g）。650 kmから5年以内に降ろせる。')),
      altitudeKm: rule(600, tx('Design choice offered to the player.', 'プレイヤーに示す設計の選択肢。')),
      inclinationDeg: est(97.8, ['nasa-orbits-catalog'], SSO_NOTE),
      contactMinPerDay: est(22, ['nasa-orbits-catalog'], CONTACT_NOTE),
      contactHighLatMinPerDay: est(49, ['nasa-orbits-catalog'], HIGHLAT_NOTE),
      science: { day: est(157475, ['nasa-firms'], FIRMS_NOTE), dayNight: est(311631, ['nasa-firms'], FIRMS_NOTE) },
      tags: ['orbit:high'],
    },

    { kind: 'choice', id: 'split-balanced', icon: 'coins', name: tx('Balanced (10% reserve)', '標準（予備費10%）'), description: tx('The reserve also covers design surprises, so only half of it can go to a budget cut; the rest is made up by dropping observations.', '予備費は設計の想定外にも使うので、予算削減に回せるのは半分。残りは観測を減らして埋める。'), cost: rule(0), settings: { reserveShare: rule(0.1) } },
    { kind: 'choice', id: 'split-lean', icon: 'coins', name: tx('Lean (0% reserve)', '切り詰め（予備費0%）'), description: tx('More money for hardware, none for surprises.', '機器に回せる分は多いが、想定外に弱い。'), cost: rule(0), settings: { reserveShare: rule(0) } },
    { kind: 'choice', id: 'split-safe', icon: 'coins', name: tx('Safe (20% reserve)', '安全重視（予備費20%）'), description: tx('Absorbs a budget cut in full. NASA projects hold 20–30% in reserve during design. Less to spend on hardware.', '予算削減を全部吸収できる。NASAの計画は設計中に20〜30%の予備費を持つ。機器に回せる分は減る。'), cost: rule(0), settings: { reserveShare: pub(0.2, ['jpl-reserves'], tx('JPL keeps 20% of the cost to go as reserve from CDR to launch (30% at proposal). JPL’s rule is a share of the cost to go; the game applies it to the whole budget. That this reserve absorbs a budget cut in full is the game’s rule.', 'JPLは詳細設計審査から打ち上げまで、残りの費用の20%を予備費として持つ（提案時は30%）。JPLの基準は残りの費用に対する割合。ゲームでは予算の総額に対する割合として扱う。予算削減を全部吸収できるとしたのはゲームの決めごと。')) } },

    {
      kind: 'part', id: 'cam-vis', icon: 'eye', subsystem: 'payload', name: tx('Visible camera', '可視カメラ'),
      description: tx('Cheap; sees smoke in daylight only.', '安いが、昼の煙しか見えない。'),
      cost: rule(60),
      massKg: pub(0.5, ['dragonfly-gecko'], tx('Off-the-shelf CubeSat RGB imager, including electronics.', '市販のCubeSat用RGBカメラ（電子回路込み）。')),
      powerW: pub(3.5, ['dragonfly-gecko'], tx('Power while imaging (under 3.5 W).', '撮影中の電力（3.5 W未満）。')),
      dataMBPerDay: rule(300, DATA_NOTE), scienceWeight: rule(0.5), observes: 'day',
      detectShare: rule(0.3, tx('Game value: it sees the smoke of large fires by day, but FIRMS counts fires found in infrared, many of them small or hidden by smoke.', 'ゲームの値：昼の大きな火災の煙は見えるが、FIRMSが数えるのは赤外で見つけた火災で、その多くは小さいか煙に隠れている。')),
    },
    {
      kind: 'part', id: 'cam-swir', icon: 'flame', subsystem: 'payload', name: tx('Short-wave infrared camera', '短波赤外カメラ'),
      description: tx('Sees active flames through smoke in daylight.', '昼なら煙越しに炎を見られる。'),
      cost: rule(250),
      massKg: pub(0.82, ['skylabs-nanoimager'], tx('CubeSat InGaAs short-wave infrared imager.', 'CubeSat用のInGaAs短波赤外カメラ。')),
      powerW: pub(6.7, ['skylabs-nanoimager'], tx('Average power.', '平均電力。')),
      dataMBPerDay: rule(500, DATA_NOTE), scienceWeight: rule(1), observes: 'day',
    },
    {
      kind: 'part', id: 'cam-tir', icon: 'thermo', subsystem: 'payload', name: tx('Thermal infrared camera', '熱赤外カメラ'),
      description: tx('Sees heat day and night; heavy and power-hungry.', '昼も夜も熱を見られるが、重く電力を食う。'),
      cost: rule(450),
      massKg: est(2.0, ['eoportal-prefire', 'nasa-cubesat101'], tx('A CubeSat thermal infrared spectrometer fills about 1.5U (PREFIRE); 1.5U × 1.33 kg per U.', 'CubeSat用の熱赤外分光計は約1.5U（PREFIRE）。1.5U × 1Uあたり1.33 kg。')),
      powerW: rule(9, tx('No public figure found for a CubeSat thermal infrared imager; game value above the other two cameras.', 'CubeSat用熱赤外カメラの電力の公表値が見つからないため、他の2つより大きいゲームの値とした。')),
      dataMBPerDay: rule(700, DATA_NOTE), scienceWeight: rule(1.2), observes: 'dayNight', tags: ['night'],
    },

    {
      kind: 'part', id: 'pwr-body', icon: 'panel', subsystem: 'power', name: tx('Body-mounted panels', '機体貼り付けパネル'),
      description: tx('Simple and reliable, limited power.', '単純で壊れにくいが、電力は少ない。'),
      cost: rule(40),
      massKg: est(0.45, ['nasa-soa-power'], tx('27.8 W peak at 62 W/kg (6U body-mounted panel, Table 3-2).', 'ピーク27.8 W、62 W/kg（6U機体貼り付けパネル、表3-2）から。')),
      generatesW: est(11, ['nasa-soa-power'], tx('27.8 W peak (Table 3-2) × 0.4 for eclipse and sun angle (game assumption).', 'ピーク27.8 W（表3-2）× 0.4（日陰と太陽の角度。ゲームの仮定）。')),
      failPerYear: rule(0.01),
    },
    {
      kind: 'part', id: 'pwr-deploy', icon: 'wings', subsystem: 'power', name: tx('Deployable panels', '展開式パネル'),
      description: tx('Much more power, one more thing to deploy.', '電力は大きいが、展開という失敗要因が増える。'),
      cost: rule(120),
      massKg: est(0.82, ['nasa-soa-power'], tx('55 W peak at 67 W/kg (6U double deployable wing, Table 3-2).', 'ピーク55 W、67 W/kg（6U両翼展開、表3-2）から。')),
      generatesW: est(22, ['nasa-soa-power'], tx('55 W peak (Table 3-2) × 0.4 for eclipse and sun angle (game assumption).', 'ピーク55 W（表3-2）× 0.4（日陰と太陽の角度。ゲームの仮定）。')),
      failPerYear: rule(0.04),
    },

    {
      kind: 'part', id: 'radio-sband', icon: 'antenna', subsystem: 'comms', name: tx('S-band transmitter (6 Mbps)', 'Sバンド送信機（6 Mbps）'),
      description: tx('The common choice for science data.', '科学データでよく使われる選択。'),
      cost: rule(60),
      massKg: nasa(0.07, ['nasa-soa-comms']),
      powerW: est(7.5, ['nasa-soa-comms'], tx('2.5 W radio output (Table 9-3) × 3 for amplifier losses (game assumption).', '送信出力2.5 W（表9-3）× 3（増幅の損失。ゲームの仮定）。')),
      downlinkMBPerMin: est(45, ['nasa-soa-comms'], tx('6,000 kbps (Table 9-3) × 60 s ÷ 8 bits.', '6,000 kbps（表9-3）× 60秒 ÷ 8ビット。')),
    },
    {
      kind: 'part', id: 'radio-xband', icon: 'antenna', subsystem: 'comms', name: tx('X-band transmitter (50 Mbps)', 'Xバンド送信機（50 Mbps）'),
      description: tx('Fast, but the licence takes extra time.', '速いが、免許の手続きに時間がかかる。'),
      cost: rule(150),
      massKg: nasa(0.13, ['nasa-soa-comms']),
      powerW: est(6, ['nasa-soa-comms'], tx('2 W radio output (Table 9-3) × 3 for amplifier losses (game assumption).', '送信出力2 W（表9-3）× 3（増幅の損失。ゲームの仮定）。')),
      downlinkMBPerMin: est(375, ['nasa-soa-comms'], tx('50,000 kbps (Table 9-3) × 60 s ÷ 8 bits.', '50,000 kbps（表9-3）× 60秒 ÷ 8ビット。')),
      leadDays: rule(60, tx('Extra time for the X-band licence.', 'Xバンドの免許の分だけ時間がかかる。')),
    },

    { kind: 'part', id: 'prot-none', icon: 'none', subsystem: 'protection', name: tx('None', 'なし'), description: tx('Lightest and cheapest.', '最も軽く安い。'), cost: rule(0), massKg: rule(0) },
    {
      kind: 'part', id: 'prot-rad', icon: 'shield', subsystem: 'protection', name: tx('Radiation-tolerant computer', '耐放射線の計算機'),
      description: tx('Off-the-shelf parts are highly susceptible to radiation; a tested computer survives most solar storms.', '市販の部品は放射線に弱い。試験済みの計算機なら、たいていの太陽嵐に耐える。'),
      cost: rule(80),
      massKg: rule(0.2, COMPUTER_MASS_NOTE),
      powerW: nasa(2, ['nasa-soa-avionics'], tx('A CubeSat computer rated for 25 krad total dose (Table 8-4).', '総線量25 kradのCubeSat用計算機（表8-4）。')),
      tags: ['radHard'],
    },
    {
      kind: 'part', id: 'prot-full', icon: 'wheel', subsystem: 'protection', name: tx('Radiation-tolerant computer + spare reaction wheel', '耐放射線の計算機＋予備のホイール'),
      description: tx('A fourth wheel keeps pointing if one fails, a common failure in small satellites.', '4つ目のホイールで、1つ壊れても向きを保てる（小型衛星でよくある故障）。'),
      cost: rule(110),
      massKg: est(0.26, ['nasa-soa-gnc'], tx('Computer (0.2 kg, game value) + one small reaction wheel 0.06 kg (Table 5-3).', '計算機（0.2 kg、ゲームの値）＋ 小型ホイール1個 0.06 kg（表5-3）。')),
      powerW: est(2.85, ['nasa-soa-avionics', 'nasa-soa-gnc'], tx('Computer 2 W (Table 8-4) + wheel 0.85 W (Table 5-3).', '計算機 2 W（表8-4）＋ ホイール 0.85 W（表5-3）。')),
      tags: ['radHard', 'spareWheel'],
    },

    {
      kind: 'launch', id: 'lv-iss-deploy', icon: 'station', name: tx('Deploy from the ISS', 'ISSから放出'),
      description: tx('Ride to the Space Station on a cargo flight, then deployed 1–3 months later. ISS orbit only.', '補給船で宇宙ステーションへ運ばれ、1〜3か月後に放出される。ISS軌道にしか行けない。'),
      cost: est(600, ['nasa-cubesat101'], tx('Up to $300k is typically enough to launch a 3U to low Earth orbit; doubled for a 6U.', '3Uを低軌道に上げるには通常30万ドルまでで足りる。6Uなので2倍。')),
      capacityKg: { 'orbit-iss': est(8, ['nasa-cubesat101'], MASS_NOTE) },
      reliability: rule(0.97),
      windowsDay: rule([300, 420]),
    },
    {
      kind: 'launch', id: 'lv-rideshare', icon: 'rocket', name: tx('Rideshare to sun-synchronous orbit', '太陽同期軌道への相乗り'),
      description: tx('Shares a large rocket going to sun-synchronous orbit.', '太陽同期軌道へ行く大型ロケットに相乗りする。'),
      cost: est(350, ['nasa-soa-launch'], tx('Rideshare prices start at $350k for about 50 kg; the game uses this starting price for the 6U, as a minimum.', '相乗りは約50 kgで35万ドルから。ゲームではこの最低料金を6Uにそのまま使う。')),
      capacityKg: {
        'orbit-sso-500': est(8, ['nasa-cubesat101'], MASS_NOTE),
        'orbit-sso-600': est(8, ['nasa-cubesat101'], MASS_NOTE),
      },
      reliability: rule(0.97),
      windowsDay: rule([330, 480]),
    },

    {
      kind: 'choice', id: 'window-first', icon: 'calendar', name: tx('Take the first flight', '最初の便に乗る'),
      description: tx('Full schedule score. If the satellite is late, it waits for the next flight; after that there is none.', '日程の点は満点。完成が遅れると次の便を待つ。その次はない。'),
      cost: rule(0), settings: { targetWindow: rule(0) },
    },
    {
      kind: 'choice', id: 'window-second', icon: 'calendar', name: tx('Book the next flight', '次の便を予約する'),
      description: tx('Plan for the next flight: half the schedule score, but more time for surprises.', '次の便に合わせて計画する。日程の点は半分だが、想定外に備える時間が増える。'),
      cost: rule(0), settings: { targetWindow: rule(1) },
    },
    {
      kind: 'choice', id: 'gs-own', icon: 'dish', name: tx('Own station (35°N)', '自前の地上局（北緯35度）'),
      description: tx('A university-style station built from amateur radio parts.', 'アマチュア無線の部品で作る、大学によくある地上局。'),
      cost: rule(20), settings: { highLatStation: rule(0), networkFactor: rule(1) },
    },
    {
      kind: 'choice', id: 'gs-highlat', icon: 'dish', name: tx('Add a high-latitude station (65°N)', '高緯度の局を足す（北緯65度）'),
      description: tx('Polar orbits pass over high latitudes often; useless for the ISS orbit.', '極に近い軌道はよく上空を通る。ISS軌道では見えない。'),
      cost: rule(60), settings: { highLatStation: rule(1), networkFactor: rule(1) },
    },
    {
      kind: 'choice', id: 'gs-network', icon: 'globe', name: tx('Commercial station network', '商用の地上局網'),
      description: tx('Pay per pass to stations around the world, including the far north: a station in view on almost every orbit, as fast-alert services such as FireSat use.', '北極圏を含む世界中の局を、1回ごとに料金を払って使う。ほぼ毎周回、どこかの局が見える。FireSatのような速報サービスはこの方式。'),
      cost: rule(150),
      tags: ['frequentContact'],
      settings: {
        highLatStation: rule(1),
        networkFactor: rule(3, tx('Pay-per-pass services are one of the ground options NASA lists for small missions; the game counts them as three times your own stations.', 'NASAは小型ミッションの地上局の選択肢として1回ごとの有料サービスを挙げている。ゲームでは自前の局の3倍の通信時間として扱う。')),
      },
    },
    {
      kind: 'choice', id: 'prep-minimal', icon: 'headset', name: tx('Minimal', '最小限'),
      description: tx('Check the ground station once before launch.', '打ち上げ前に地上局を一度確認するだけ。'),
      cost: rule(0), settings: { earlyFailureFactorOps: rule(1) },
    },
    {
      kind: 'choice', id: 'prep-rehearsal', icon: 'headset', name: tx('Full rehearsal', '通しのリハーサル'),
      description: tx('Test the ground station early and often, with the satellite in the loop.', '地上局を早くから何度も、衛星とつないで試す。'),
      cost: rule(40), leadDays: rule(15),
      settings: { earlyFailureFactorOps: est(0.6, ['nasa-cubesat101'], tx('CubeSat 101: test the ground station early and often; an inadequate one is a mission killer. Game effect: 40% fewer early failures.', 'CubeSat 101：地上局は早くから何度も試すこと、不備はミッションを失う原因。ゲームでは初期故障を4割減らす。')) },
    },
    {
      kind: 'choice', id: 'em-none', icon: 'none', name: tx('No spare unit', '予備機なし'),
      description: tx('Test the flight unit only.', '本番の機体だけで試験する。'),
      cost: rule(0),
    },
    {
      kind: 'choice', id: 'em-build', icon: 'boxes', name: tx('Build an engineering model', '予備機を作る'),
      description: tx('A ground copy for testing; it does not fly. Integration problems show up on the copy, so fewer satellites die right after launch.', '試験用の地上の複製機。宇宙には行かない。組み立ての問題を複製機で見つけるので、打ち上げ直後に動かなくなる衛星が減る。'),
      cost: rule(80), leadDays: rule(20),
      settings: { earlyFailureFactorEM: rule(0.7, tx('Game value: 30% fewer satellites that never work after launch.', 'ゲームの値：打ち上げ後に動かない確率を3割減らす。')) },
      tags: ['engineeringModel'],
    },
    { kind: 'choice', id: 'test-basic', icon: 'clipboard', name: tx('Basic', '最小限'), description: tx('Functional tests only.', '動作確認のみ。'), cost: rule(20), leadDays: rule(15), settings: { testDepth: rule(1) } },
    {
      kind: 'choice', id: 'test-standard', icon: 'clipboard', name: tx('Standard', '標準'),
      description: tx('Vibration and thermal vacuum tests, the usual verification for a CubeSat launch.', '振動試験と熱真空試験。CubeSatの打ち上げで通常求められる検証。'),
      cost: rule(60), leadDays: rule(30), settings: { testDepth: rule(2) },
    },
    {
      kind: 'choice', id: 'test-full', icon: 'clipboard', name: tx('Full', '徹底'),
      description: tx('Adds a "day in the life" rehearsal of the whole mission.', '運用1日分を通して試す試験（DITL）も行う。'),
      cost: rule(120), leadDays: rule(50), settings: { testDepth: rule(3) },
    },

    { kind: 'choice', id: 'ops-steady', icon: 'eye', name: tx('Steady', '標準'), description: tx('Observe on most passes over land.', '陸上を通るときはたいてい観測する。'), cost: rule(0), settings: { dutyCycle: rule(0.5) } },
    { kind: 'choice', id: 'ops-aggressive', icon: 'eye', name: tx('Aggressive', '積極的'), description: tx('Observe on every pass. Strains power and downlink, and wears the battery faster.', '毎回観測する。電力と通信に負担がかかり、電池が早く劣化しやすい。'), cost: rule(0), settings: { dutyCycle: rule(0.9) } },
    { kind: 'choice', id: 'ops-conservative', icon: 'eye', name: tx('Conservative', '控えめ'), description: tx('Observe fire-season regions only.', '火災の季節の地域だけ観測する。'), cost: rule(0), settings: { dutyCycle: rule(0.25) } },
  ],

  events: [
    {
      id: 'budget-cut', phase: 1, name: tx('Budget cut', '予算の削減'),
      story: tx('The programme budget is cut by 10%.', '計画の予算が10%削減された。'),
      probability: rule(0.3),
      // A 20% reserve absorbs the cut (JPL keeps 20–30% during design); 10% absorbs half and the rest is
      // found by descoping; with no reserve the whole cut is taken from the hardware and the operations.
      protectedIf: { kind: 'setting', key: 'reserveShare', atLeast: 0.2 },
      partialIf: { kind: 'setting', key: 'reserveShare', atLeast: 0.1 },
      partial: [{ kind: 'resource', resource: 'budget', delta: -75 }, { kind: 'scienceFactor', factor: 0.9 }],
      unprotected: [{ kind: 'resource', resource: 'budget', delta: -150 }, { kind: 'scienceFactor', factor: 0.75 }],
      lesson: tx('{agency} had no reserve when the budget was cut.', '{agency}は、予算削減のときに予備費がなかった。'),
    },
    {
      id: 'part-delay', phase: 2, name: tx('Supplier delay', '部品の納期遅延'),
      story: tx('A supplier is late with a key part.', '主要部品の納入が遅れた。'),
      probability: rule(0.35),
      protectedIf: { kind: 'margin', resource: 'schedule', atLeast: 0.15 },
      unprotected: [{ kind: 'delayDays', days: 45 }],
      lesson: tx('{agency} had no schedule margin when a part arrived late.', '{agency}は、部品が遅れたときに日程の余裕がなかった。'),
      realCase: {
        who: tx('Psyche', 'Psyche'),
        year: '2022',
        text: tx('Psyche: late flight software and test equipment made the asteroid mission miss its 2022 launch window.', 'Psyche：飛行ソフトと試験設備の遅れで、小惑星探査機が2022年の打ち上げ窓を逃した。'),
        sources: ['nasa-psyche-irb'],
      },
    },
    {
      id: 'long-wait', phase: 3, name: tx('Long wait in the rocket', '打ち上げ待ちで電池が減る'),
      story: tx('Your CubeSat is loaded into the rocket months before launch and waits there without charging.', 'キューブサットは打ち上げの何か月も前にロケットに積まれ、充電できないまま待つ。'),
      probability: rule(0.3),
      protectedIf: { kind: 'margin', resource: 'power', atLeast: 0.4 },
      unprotected: [{ kind: 'failChance', subsystem: 'power', add: 0.1 }],
      lesson: tx('{agency} had little power margin, and its battery came out of the long wait weakened.', '{agency}は電力に余裕がなく、長い待ちのあと電池が弱っていた。'),
      realCase: {
        who: tx('Artemis I CubeSats', 'Artemis I のキューブサット'),
        year: '2022',
        text: tx('Artemis I: the CubeSats sat inside the rocket for over a year, and only some could have their batteries recharged before launch.', 'Artemis I：キューブサットはロケットの中で1年以上待ち、打ち上げ前に電池を再充電できたのは一部だけだった。'),
        sources: ['sfn-artemis-cubesats'],
      },
    },
    {
      id: 'test-anomaly', phase: 4, name: tx('Test anomaly', '試験での不具合'),
      story: tx('A hidden fault is lurking in the spacecraft.', '機体に隠れた不具合がある。'),
      probability: rule(0.4),
      protectedIf: { kind: 'setting', key: 'testDepth', atLeast: 2 },
      partialIf: { kind: 'hasTag', tag: 'engineeringModel' },
      partial: [{ kind: 'failChance', subsystem: 'cdh', add: 0.05 }],
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.2 }],
      lesson: tx('Light testing let a fault through to orbit for {agency}.', '{agency}は、試験が薄く不具合を軌道まで持ち込んだ。'),
      realCase: {
        who: tx('Lunar Trailblazer', 'Lunar Trailblazer'),
        year: '2025',
        text: tx('Lunar Trailblazer (2025): contact was lost the day after launch; its solar arrays did not point at the Sun and the battery ran down.', 'Lunar Trailblazer（2025年）：打ち上げの翌日に通信が途絶えた。太陽電池が太陽を向かず、電池が尽きた。'),
        sources: ['nasa-trailblazer'],
      },
    },
    {
      id: 'launch-failure', phase: 4, name: tx('Launch failure', '打ち上げ失敗'),
      story: tx('The rocket fails to reach orbit.', 'ロケットが軌道に届かなかった。'),
      probability: rule(0, tx('Drawn from the chosen rocket’s reliability instead of a fixed chance.', '一定の確率ではなく、選んだロケットの信頼性から引く。')),
      unprotected: [{ kind: 'missionLost', outcome: 'launchFailure' }],
      lesson: tx('{agency} lost its satellite at launch.', '{agency}は、打ち上げで衛星を失った。'),
    },
    {
      id: 'solar-flare', phase: 5, name: tx('Solar storm', '太陽嵐'),
      story: tx(
        'A solar flare sends a burst of high-energy particles. They can upset or damage the spacecraft computer.',
        '太陽フレアに伴って高エネルギーの粒子が降り注いだ。機体の計算機が誤動作したり壊れたりするおそれがある。',
      ),
      probability: est(0.71, ['nasa-donki'], tx(
        'Share of 12-month periods in 2014–2025 with at least one solar energetic particle (SEP) episode seen near Earth (GOES or SOHO) in DONKI: 95 of 133. Records within 3 days are one episode. See data/donki-sep-2014-2025.json (nearEarth).',
        '2014〜2025年の12か月の期間のうち、DONKIに地球近傍（GOESかSOHO）で観測された太陽高エネルギー粒子（SEP）の記録が1回以上ある期間の割合：133のうち95。3日以内の記録は1回とまとめた。data/donki-sep-2014-2025.json（nearEarth）を参照。',
      )),
      protectedIf: { kind: 'hasTag', tag: 'radHard' },
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.5 }],
      lesson: tx('The same solar storm hit everyone; {agency} had no radiation protection.', '同じ太陽嵐が全機関を襲った。{agency}には放射線対策がなかった。'),
    },
    {
      id: 'wheel-failure', phase: 5, name: tx('Reaction wheel failure', 'ホイールの故障'),
      story: tx('A reaction wheel stops spinning.', '姿勢制御のホイールが止まった。'),
      probability: rule(0.15),
      protectedIf: { kind: 'hasTag', tag: 'spareWheel' },
      unprotected: [{ kind: 'scienceFactor', factor: 0.6 }],
      lesson: tx('{agency} lost pointing accuracy without a spare wheel.', '{agency}は、予備のホイールがなく指向精度を失った。'),
      realCase: {
        who: tx('Kepler', 'Kepler'),
        year: '2013',
        text: tx('Kepler: the second of its four wheels failed in May 2013 and the original survey ended. It came back as K2, using sunlight pressure as a “third wheel”.', 'Kepler：4つのホイールのうち2つ目が2013年5月に壊れ、本来の観測が終わった。太陽光の圧力を「3つ目のホイール」に使うK2として復活した。'),
        sources: ['nasa-kepler-k2'],
      },
    },
    {
      id: 'station-cut', phase: 5, name: tx('Ground station time cut', '地上局の割り当て減'),
      story: tx('Other users need the ground stations, and your contact time is cut.', 'ほかの利用者が地上局を必要とし、通信時間が削られた。'),
      probability: rule(0.25),
      protectedIf: { kind: 'margin', resource: 'downlink', atLeast: 0.75 },
      unprotected: [{ kind: 'scienceFactor', factor: 0.9 }],
      lesson: tx('{agency} could not downlink everything when station time was cut.', '{agency}は、地上局の時間が減ったときにデータを送りきれなかった。'),
    },
    {
      id: 'storm-drag', phase: 5, name: tx('Geomagnetic storm drag', '磁気嵐で大気の抵抗が増える'),
      story: tx('A geomagnetic storm heats the upper atmosphere. Low satellites feel extra drag and lose their pointing for a while.', '磁気嵐で上層大気が温まった。低い軌道の衛星は抵抗が増え、しばらく姿勢を保てない。'),
      probability: rule(0.3),
      protectedIf: { kind: 'hasTag', tag: 'orbit:high' },
      unprotected: [{ kind: 'scienceFactor', factor: 0.95 }],
      lesson: tx('{agency} flew lower and lost observing time when a storm thickened the air.', '{agency}は低い軌道を飛び、嵐で大気が濃くなったときに観測の時間を失った。'),
      realCase: {
        who: tx('ICESat-2', 'ICESat-2'),
        year: '2024',
        text: tx('ICESat-2 (May 2024): during the Gannon storm, extra drag at about 480 km turned the spacecraft and put it into safe hold; Starlink raised about 5,000 satellites at once.', 'ICESat-2（2024年5月）：ガノン嵐のとき、高度約480 kmで想定外の抵抗を受けて姿勢が回り、セーフホールドに入った。Starlinkは約5,000機の軌道を一斉に上げた。'),
        sources: ['knipp-gannon'],
      },
    },
    {
      id: 'battery-wear', phase: 5, name: tx('Battery wear', '電池の劣化'),
      story: tx('A satellite in low orbit charges and discharges its battery about 5,500 times a year. Imaging on every orbit drains it deeper each time.', '低軌道の衛星は、年に約5,500回、電池の充電と放電をくり返す。毎周回撮影すると、そのたびに深く放電する。'),
      probability: rule(0.8, tx('Game value: a card for the general rule that repeated deep discharges wear a battery out sooner. The chance is high because the design, not luck, decides it.', 'ゲームの値：深い放電をくり返すと電池が早く劣化する、という一般的な性質をカードにした。確率は設計で決まるので高くした。')),
      // A steady or conservative plan keeps discharges shallow; a large power margin also helps.
      protectedIf: { kind: 'any', of: [{ kind: 'settingAtMost', key: 'dutyCycle', atMost: 0.6 }, { kind: 'margin', resource: 'power', atLeast: 0.6 }] },
      partialIf: { kind: 'margin', resource: 'power', atLeast: 0.4 },
      partial: [{ kind: 'failChance', subsystem: 'power', add: 0.15 }],
      unprotected: [{ kind: 'failChance', subsystem: 'power', add: 0.4 }],
      lesson: tx('{agency} imaged on every orbit with little power to spare, and its battery wore out early.', '{agency}は電力に余裕がないまま毎周回撮影し、電池が早く劣化した。'),
      realCase: {
        who: tx('Battery tests for nanosatellites', '超小型衛星の電池の試験'), year: '2020',
        text: tx('A battery in low orbit goes through about 5,500 charge cycles a year. In these tests, temperature was the largest cause of wear.', '低軌道の電池は年に約5,500回の充放電をくり返す。この試験では、温度が劣化の最大の要因だった。'),
        sources: ['knap-battery'],
      },
    },
    {
      id: 'big-fire-season', phase: 5, name: tx('Major fire season', '大規模な火災シーズン'),
      story: tx('An intense fire season: a chance for valuable observations.', '火災が多い季節になった。価値ある観測の好機。'),
      probability: rule(0.3),
      unprotected: [],
      readyIf: { kind: 'margin', resource: 'power', atLeast: 0.4 },
      benefit: [{ kind: 'scienceFactor', factor: 1.2 }],
      lesson: tx('{agency} had the power margin to observe the major fire season.', '{agency}は、電力に余裕があり大規模な火災シーズンを観測できた。'),
    },
  ],
};
