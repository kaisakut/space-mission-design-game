import type { Mission } from '../types';
import { est, nasa, pub, rule, tx } from '../helpers';

/**
 * Mission 2 (playable): a solar-powered rover that maps water ice near the lunar south pole.
 *
 * Modelled on NASA's VIPER rover (mass, power, instruments, communications, 100-day mission) and its
 * commercial (CLPS) delivery. Landing sites, science opportunities and prices are game values: the
 * sources give the rover and the delivery, not a menu of alternatives.
 */

const SCIENCE_NOTE = tx(
  'Game value. VIPER planned about 20 km of driving with its spectrometers on continuously, and drill holes 1 m deep giving about ten samples each; sites differ in how much ice they are likely to hold.',
  'ゲームの値。VIPERは約20 kmを走りながら分光計で連続して測定し、深さ1 mの穴1つから約10個の試料を取る計画だった。着陸地点ごとに氷の多さが違う。',
);
const DATA_NOTE = tx('Game value for the standard driving plan; the plan you pick scales it.', '標準の走行計画でのゲームの値。選んだ計画に応じて増減する。');
const CONTACT_NOTE = tx(
  'Game value: seen from the south pole, Earth sets about every two weeks, and the rover must wait at a safe spot until it rises again. Sites with a better view of Earth get more contact.',
  'ゲームの値。南極から見ると地球は約2週間ごとに沈み、そのあいだローバーは安全な場所で待つ。地球がよく見える地点ほど通信時間が長い。',
);
const SUN_NOTE = tx(
  'Game value: near the pole the Sun stays low; arrays on the rover’s sides catch it, but crater edges shade them.',
  'ゲームの値。極の近くでは太陽が低い。ローバー側面の太陽電池で受けるが、クレーターの縁では影になる。',
);

export const lunarIceRover: Mission = {
  id: 'lunar-ice-rover',
  name: tx('Lunar South Pole Ice Rover', '月南極の水氷探査ローバー'),
  summary: tx(
    'Land a rover near the Moon’s south pole and map where water ice is, before the cold and dark end the mission.',
    '月の南極近くにローバーを着陸させ、寒さと暗さでミッションが終わる前に、水氷がどこにあるかを調べる。',
  ),
  difficulty: 'intermediate',
  playable: true,
  budgetKUSD: est(500000, ['spo-viper', 'spacenews-viper-griffin'], tx(
    'Game value for the rover, its instruments and a medium lander. For comparison, NASA’s cost commitment for VIPER was $433.5 million without delivery (later estimated at $609.6 million), and the Griffin delivery grew from $199.5 million to $323 million.',
    'ローバー・機器・中型の着陸機を合わせたゲームの値。比較のため：VIPERの費用の約束は輸送を含まず4億3350万ドル（のちの見込みは6億960万ドル）、Griffinによる輸送の契約は1億9950万ドルから3億2300万ドルに増えた。',
  )),
  opsDays: nasa(100, ['nasa-viper-mission'], tx('Planned mission length: 100 Earth days, about three lunar day–night cycles.', '計画されたミッション期間：地球の100日、月の昼と夜の約3回分。')),
  bus: {
    massKg: est(417, ['nasa-viper-hw-2024', 'nasa-viper-overview-2020'], tx('Roving mass 447 kg minus the four science instruments (about 30 kg).', '走行時の質量447 kgから、4つの科学機器（約30 kg）を除いた値。')),
    powerW: rule(120, tx('Game value for driving, avionics and heaters on average.', '走行・電子機器・ヒーターの平均のゲームの値。')),
    cost: rule(150000, tx('Game value for the rover without instruments, within the mission budget.', 'ミッション予算のうち、機器を除いたローバー本体の分（ゲームの値）。')),
    devDays: rule(900, tx('Game value: about two and a half years from concept to delivery.', 'ゲームの値：構想から引き渡しまで約2年半。')),
    maxMassKg: nasa(490, ['nasa-viper-hw-2024'], tx('VIPER launch mass including the lander interface.', '着陸機との接続部を含むVIPERの打ち上げ質量。')),
    failPerYear: rule(0.4, tx('Game value per year; the 100-day mission faces about a quarter of it.', '1年あたりのゲームの値。100日のミッションではその約4分の1。')),
  },
  rules: {
    scienceUnit: tx('ice measurements', '件の氷の測定'),
    scienceFullScore: rule(4000, tx('Science value for the full science score.', '科学価値の満点の基準。')),
    earlyFailureByTestDepth: rule([0.2, 0.1, 0.05], tx('Game values: chance the rover never drives off the lander, by test depth.', '試験の深さごとの、ローバーが着陸機から降りられない確率（ゲームの値）。')),
    changeFactors: rule([1.5, 3, 6]),
    changeMinKUSD: rule(5000, tx('Redesign work even when the new part costs nothing.', '部品が無料でも、設計のやり直しに費用がかかる。')),
    changeDelayDaysPerPhase: rule(30),
  },
  outcomeLabels: {
    launchFailure: tx('Landing failure', '着陸失敗'),
    orbitFailure: tx('Stuck on the lander', '着陸機から降りられず'),
  },
  primary: {
    id: 'map-ice',
    name: tx('Map the ice', '氷を調べる'),
    description: tx('Send back enough measurements to show where water ice is and how deep.', '水氷がどこに、どの深さにあるかがわかるだけの測定を送り届ける。'),
    points: rule(35),
    rule: { kind: 'science', atLeast: 600, partialAtLeast: 150 },
  },
  secondary: [
    {
      id: 'isotopes', name: tx('Isotopes', '同位体'),
      description: tx('Measure the water’s isotopes (needs the mass spectrometer).', '水の同位体を測る（質量分析計が必要）。'),
      points: rule(5), rule: { kind: 'hasTag', tag: 'isotopes' }, chosenBy: 'goal:isotopes',
    },
    {
      id: 'cold-trap', name: tx('Drill in a cold trap', '低温域で掘る'),
      description: tx('Land by a permanently shadowed crater and drill there.', '永久影のクレーターのそばに着陸し、そこで掘る。'),
      points: rule(5), rule: { kind: 'all', of: [{ kind: 'hasTag', tag: 'site:coldtrap' }, { kind: 'hasTag', tag: 'drill' }] }, chosenBy: 'goal:coldtrap',
    },
    {
      id: 'full-mission', name: tx('All three lunar days', '月の昼3回分'),
      description: tx('Keep driving for the full 100 days.', '100日間、最後まで走り続ける。'),
      points: rule(5), rule: { kind: 'survive' }, chosenBy: 'goal:full',
    },
  ],
  rubric: { primary: rule(35), secondary: rule(15), science: rule(25), budget: rule(15), schedule: rule(10) },

  slots: [
    {
      id: 'secondary', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Secondary objectives', '副目的'),
      help: tx('Each one adds points but also requirements. Agencies chasing the same one split its points.', '1つごとに加点されますが、要求も増えます。同じ副目的を狙う機関が多いと得点が割れます。'),
      options: ['lsec-none', 'lsec-isotopes', 'lsec-coldtrap', 'lsec-full'], multi: { min: 0, max: 2, noneFirst: true },
    },
    {
      id: 'site', default: 'site-nobile', phase: 1, role: 'lead', changeKind: 'hardware',
      label: tx('Landing site', '着陸地点'),
      help: tx('Decides sunlight, contact with Earth and how much ice there may be. Changing it later is expensive.', '日射、地球との通信、氷の多さが決まります。後から変えると高くつきます。'),
      options: ['site-ridge', 'site-nobile', 'site-coldtrap'],
    },
    {
      id: 'budget-split', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Budget split', '予算の配分'),
      help: tx('How much to keep in reserve for surprises.', '想定外に備えて、予備費をどれだけ残すか。'),
      options: ['lsplit-balanced', 'lsplit-lean', 'lsplit-safe'],
    },
    {
      id: 'instruments', default: 'inst-nss', phase: 2, role: 'science', changeKind: 'hardware',
      label: tx('Science instruments', '科学機器'),
      help: tx('What the rover can measure. Each instrument adds mass, power and cost.', 'ローバーが何を測れるか。機器ごとに質量・電力・費用が増えます。'),
      options: ['inst-nss', 'inst-nirvss', 'inst-msolo', 'inst-trident'], multi: { min: 1, max: 3 },
    },
    {
      id: 'power', default: 'lpwr-two', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Solar arrays and battery', '太陽電池と電池'),
      help: tx('More arrays and a bigger battery let the rover work longer in shadow.', '太陽電池と電池を増やすと、影の中で長く動けます。'),
      options: ['lpwr-two', 'lpwr-three'],
    },
    {
      id: 'radio', default: 'lcomm-hga', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Antenna', 'アンテナ'),
      help: tx('The rover talks straight to Earth, with no relay satellite.', 'ローバーは中継衛星を使わず、地球と直接通信します。'),
      options: ['lcomm-lga', 'lcomm-hga'],
    },
    {
      id: 'thermal', default: 'lthermal-std', phase: 2, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Surviving the cold', '寒さへの備え'),
      help: tx('Shadows reach about 40 K (−233 °C). Radioisotope heaters keep the rover warm through a long night.', '影は約40 K（−233 °C）まで冷えます。放射性同位体ヒーターがあれば長い夜も温かく保てます。'),
      options: ['lthermal-std', 'lthermal-rhu'],
    },
    {
      id: 'lander', default: 'lander-medium', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Lunar delivery', '月への輸送'),
      help: tx('A commercial lander carries the rover to the surface. NASA accepts more risk with these services.', '民間の着陸機がローバーを月面まで運びます。NASAはこの方式で、より大きなリスクを受け入れています。'),
      options: ['lander-medium', 'lander-large'],
    },
    {
      id: 'window', default: 'lwindow-first', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Launch window', '打ち上げ窓'),
      help: tx('Aim at the first window for the best schedule score, or plan for the next one to keep time in hand.', '最初の窓を狙えば日程の点が高く、次の窓を狙えば時間に余裕ができます。'),
      options: ['lwindow-first', 'lwindow-second'],
    },
    {
      id: 'ground', default: 'dsn-standard', phase: 3, role: 'powerComms', changeKind: 'plan',
      label: tx('Deep Space Network time', '深宇宙通信網の時間'),
      help: tx('Large antennas on Earth receive the rover’s data. More booked time means more data down.', '地球の大型アンテナがデータを受け取ります。時間を多く確保するほど、多くのデータを降ろせます。'),
      options: ['dsn-standard', 'dsn-priority'],
    },
    {
      id: 'testing', default: 'ltest-standard', phase: 4, role: 'spacecraft', changeKind: 'plan',
      label: tx('Test campaign', '試験の深さ'),
      help: tx('Deeper testing finds faults before launch but uses time and money.', '試験を厚くすると打ち上げ前に不具合を見つけられますが、時間と費用を使います。'),
      options: ['ltest-basic', 'ltest-standard', 'ltest-full'],
    },
    {
      id: 'ops-prep', default: 'lprep-minimal', phase: 4, role: 'lead', changeKind: 'plan',
      label: tx('Operations readiness', '運用の準備'),
      help: tx('Train the drive team: a command cycle on the Moon takes minutes, not seconds.', '運転チームを訓練します。月では指令1回のやり取りに数秒ではなく数分かかります。'),
      options: ['lprep-minimal', 'lprep-rehearsal'],
    },
    {
      id: 'model', default: 'lem-none', phase: 4, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Mobility test rover', '走行試験用の予備機'),
      help: tx('The flight rover cannot carry its own weight in Earth’s gravity; a lighter copy tests driving.', '本番のローバーは地球の重力では自重を支えられません。軽い複製機で走行を試します。'),
      options: ['lem-none', 'lem-build'],
    },
    {
      id: 'ops-plan', phase: 5, role: 'science', changeKind: 'plan',
      label: tx('Driving plan', '走行計画'),
      help: tx('Driving and drilling more gathers more data but uses more power and risks getting stuck.', '多く走り多く掘るほどデータは増えますが、電力を使い、はまる危険も増えます。'),
      options: ['ldrive-steady', 'ldrive-aggressive', 'ldrive-careful'],
    },
  ],

  options: [
    { kind: 'choice', id: 'lsec-none', name: tx('None', 'なし'), description: tx('Focus on the primary objective.', '主目的に集中する。'), cost: rule(0) },
    { kind: 'choice', id: 'lsec-isotopes', name: tx('Isotopes', '同位体'), description: tx('Needs the mass spectrometer.', '質量分析計が必要。'), cost: rule(0), tags: ['goal:isotopes'] },
    { kind: 'choice', id: 'lsec-coldtrap', name: tx('Drill in a cold trap', '低温域で掘る'), description: tx('Needs the cold-trap site and the drill.', '低温域の着陸地点とドリルが必要。'), cost: rule(0), tags: ['goal:coldtrap'] },
    { kind: 'choice', id: 'lsec-full', name: tx('All three lunar days', '月の昼3回分'), description: tx('Needs to survive the nights.', '夜を越せる備えが必要。'), cost: rule(0), tags: ['goal:full'] },

    {
      kind: 'orbit', id: 'site-ridge', name: tx('Sunlit ridge', '日当たりのよい尾根'),
      description: tx('Long sunlight and a good view of Earth, but ice is less likely to last here.', '日照が長く地球もよく見えるが、氷は残りにくい。'),
      cost: rule(0),
      solarFactor: rule(1.0, SUN_NOTE),
      contactMinPerDay: rule(720, CONTACT_NOTE),
      science: { prospect: rule(1200, SCIENCE_NOTE), surface: rule(900, SCIENCE_NOTE), gas: rule(700, SCIENCE_NOTE), drill: rule(30, SCIENCE_NOTE) },
    },
    {
      kind: 'orbit', id: 'site-nobile', name: tx('West of Nobile crater (VIPER’s site)', 'ノビレ・クレーターの西（VIPERの予定地）'),
      description: tx('The area NASA chose for VIPER, about 84.6°S: a balance of sunlight, Earth view and ice.', 'NASAがVIPERのために選んだ地域（南緯約84.6度）。日照・地球の見え方・氷のつり合いがよい。'),
      cost: rule(0),
      solarFactor: rule(0.8, SUN_NOTE),
      contactMinPerDay: rule(600, CONTACT_NOTE),
      science: { prospect: rule(2000, SCIENCE_NOTE), surface: rule(1500, SCIENCE_NOTE), gas: rule(1200, SCIENCE_NOTE), drill: rule(60, SCIENCE_NOTE) },
    },
    {
      kind: 'orbit', id: 'site-coldtrap', name: tx('Edge of a permanently shadowed crater', '永久影のクレーターの縁'),
      description: tx('The most ice, but little sunlight and short contact with Earth.', '氷は最も多いが、日射は弱く、地球との通信も短い。'),
      cost: rule(0),
      solarFactor: rule(0.5, SUN_NOTE),
      contactMinPerDay: rule(360, CONTACT_NOTE),
      science: { prospect: rule(2600, SCIENCE_NOTE), surface: rule(2000, SCIENCE_NOTE), gas: rule(1600, SCIENCE_NOTE), drill: rule(100, SCIENCE_NOTE) },
      tags: ['site:coldtrap'],
    },

    { kind: 'choice', id: 'lsplit-balanced', name: tx('Balanced (10% reserve)', '標準（予備費10%）'), description: tx('A typical reserve.', '一般的な予備費。'), cost: rule(0), settings: { reserveShare: rule(0.1) } },
    { kind: 'choice', id: 'lsplit-lean', name: tx('Lean (0% reserve)', '切り詰め（予備費0%）'), description: tx('More money for hardware, none for surprises.', '機器に回せる分は多いが、想定外に弱い。'), cost: rule(0), settings: { reserveShare: rule(0) } },
    { kind: 'choice', id: 'lsplit-safe', name: tx('Safe (25% reserve)', '安全重視（予備費25%）'), description: tx('Survives cuts, less to spend on hardware.', '削減に耐えるが、機器に回せる分が減る。'), cost: rule(0), settings: { reserveShare: rule(0.25) } },

    {
      kind: 'part', id: 'inst-nss', subsystem: 'payload', name: tx('Neutron spectrometer (NSS)', '中性子分光計（NSS）'),
      description: tx('Senses hydrogen, a sign of water, down to about 1 m while driving.', '走りながら、深さ約1 mまでの水素（水の手がかり）を感じ取る。'),
      cost: rule(8000),
      massKg: nasa(1.9, ['nasa-viper-instruments-2022']),
      powerW: nasa(1.6, ['nasa-viper-instruments-2022']),
      dataMBPerDay: rule(5, DATA_NOTE), scienceWeight: rule(1), observes: 'prospect',
    },
    {
      kind: 'part', id: 'inst-nirvss', subsystem: 'payload', name: tx('Near-infrared spectrometer (NIRVSS)', '近赤外分光計（NIRVSS）'),
      description: tx('Sees water and hydroxyl on the surface and in drill cuttings.', '地表と掘りくずの水・水酸基を見る。'),
      cost: rule(12000),
      massKg: nasa(3.57, ['nasa-viper-overview-2020']),
      powerW: est(17.3, ['nasa-viper-overview-2020'], tx('Spectrometer 12 W + bracket assembly 5.26 W (average).', '分光計 12 W ＋ ブラケット部 5.26 W（平均）。')),
      dataMBPerDay: rule(300, DATA_NOTE), scienceWeight: rule(1), observes: 'surface',
    },
    {
      kind: 'part', id: 'inst-msolo', subsystem: 'payload', name: tx('Mass spectrometer (MSolo)', '質量分析計（MSolo）'),
      description: tx('Identifies the gases released from the soil, including water isotopes.', '土から出るガスを調べる。水の同位体も測れる。'),
      cost: rule(15000),
      massKg: nasa(6, ['nasa-viper-overview-2020']),
      powerW: nasa(35, ['nasa-viper-overview-2020'], tx('Average while scanning.', '走査中の平均。')),
      dataMBPerDay: rule(50, DATA_NOTE), scienceWeight: rule(1.2), observes: 'gas', tags: ['isotopes'],
    },
    {
      kind: 'part', id: 'inst-trident', subsystem: 'payload', name: tx('1 m drill (TRIDENT)', '1 mドリル（TRIDENT）'),
      description: tx('Brings up soil from as deep as 1 m, in about 10 cm steps.', '深さ1 mまでの土を、約10 cmずつ掘り上げる。'),
      cost: rule(25000),
      massKg: nasa(18, ['nasa-viper-overview-2020'], tx('Including launch locks.', '打ち上げ時の固定具を含む。')),
      powerW: rule(60, tx('Game value: under 5 W idle, much more while drilling.', 'ゲームの値。待機時は5 W未満、掘削中はずっと多い。')),
      dataMBPerDay: rule(100, DATA_NOTE), scienceWeight: rule(10), observes: 'drill', tags: ['drill'],
    },

    {
      kind: 'part', id: 'lpwr-two', subsystem: 'power', name: tx('Two side arrays', '側面の太陽電池2枚'),
      description: tx('The basic layout; the battery lasts a short shadow.', '基本の構成。電池は短い影なら持つ。'),
      cost: rule(0), massKg: rule(0, tx('Included in the rover’s mass.', 'ローバー本体の質量に含む。')),
      generatesW: est(320, ['nasa-viper-hw-2024'], tx('Two arrays of 320 W each × 0.5 for the low Sun and changing angles (game assumption).', '320 Wの太陽電池2枚 × 0.5（低い太陽と向きの変化。ゲームの仮定）。')),
      failPerYear: rule(0.02),
    },
    {
      kind: 'part', id: 'lpwr-three', subsystem: 'power', name: tx('Three arrays and a bigger battery', '太陽電池3枚と大きな電池'),
      description: tx('Like VIPER: arrays on three sides and a 5.4 kWh battery for longer shadows.', 'VIPERと同じく3面の太陽電池と5.4 kWhの電池で、長い影にも耐える。'),
      cost: rule(15000), massKg: rule(25, tx('Game value for the third array and the larger battery.', '3枚目の太陽電池と大きな電池の分のゲームの値。')),
      generatesW: est(480, ['nasa-viper-hw-2024'], tx('Three arrays of 320 W each × 0.5 (game assumption); battery 5,420 Wh at start of life.', '320 Wの太陽電池3枚 × 0.5（ゲームの仮定）。電池は初期容量5,420 Wh。')),
      failPerYear: rule(0.02), tags: ['bigBattery'],
    },

    {
      kind: 'part', id: 'lcomm-lga', subsystem: 'comms', name: tx('Low-gain antenna only', '低利得アンテナのみ'),
      description: tx('Always pointed at Earth, but only 250 symbols per second.', '常に地球に向くが、毎秒250シンボルしか送れない。'),
      cost: rule(2000), massKg: rule(1),
      powerW: rule(20),
      downlinkMBPerMin: est(0.0019, ['nasa-viper-hw-2024'], tx('250 symbols per second (VIPER minimum) taken as 250 bits per second.', '毎秒250シンボル（VIPERの最小値）を毎秒250ビットとして換算。')),
    },
    {
      kind: 'part', id: 'lcomm-hga', subsystem: 'comms', name: tx('Gimballed high-gain antenna (X-band)', '可動式の高利得アンテナ（Xバンド）'),
      description: tx('VIPER’s main link: up to 8 million symbols per second, straight to Earth.', 'VIPERの主回線。地球へ直接、毎秒最大800万シンボル。'),
      cost: rule(10000), massKg: rule(8, tx('Game value for the antenna and gimbal on the mast.', 'マスト上のアンテナと可動部のゲームの値。')),
      powerW: rule(60),
      downlinkMBPerMin: est(60, ['nasa-viper-hw-2024'], tx('8 million symbols per second (VIPER maximum) taken as 8 Mbit/s: × 60 s ÷ 8 bits.', '毎秒800万シンボル（VIPERの最大値）を8 Mbit/sとして換算：× 60秒 ÷ 8ビット。')),
    },

    {
      kind: 'part', id: 'lthermal-std', subsystem: 'thermal', name: tx('Heat pipes and radiators', 'ヒートパイプと放熱板'),
      description: tx('VIPER’s solar-only design: it must reach a sunny safe spot before each night.', 'VIPERと同じ太陽光だけの設計。夜の前に日の当たる安全な場所へ移動する必要がある。'),
      cost: rule(0), massKg: rule(0, tx('Included in the rover’s mass.', 'ローバー本体の質量に含む。')),
    },
    {
      kind: 'part', id: 'lthermal-rhu', subsystem: 'thermal', name: tx('Add radioisotope heater units', '放射性同位体ヒーターを足す'),
      description: tx('Keeps the electronics warm through a long night; needs extra safety approval.', '長い夜でも電子機器を温める。安全審査が追加で必要。'),
      cost: rule(20000), leadDays: rule(120, tx('Game value for the extra launch safety review.', '打ち上げの安全審査が増える分のゲームの値。')),
      massKg: rule(5),
      tags: ['nightSurvival'],
    },

    {
      kind: 'launch', id: 'lander-medium', name: tx('Medium commercial lander', '中型の民間着陸機'),
      description: tx('The class chosen for VIPER: up to 500 kg to the surface.', 'VIPERに選ばれた級。月面へ最大500 kg。'),
      cost: pub(199500, ['spacenews-viper-griffin'], tx('VIPER’s delivery task order, including launch and landing.', 'VIPERの輸送契約（打ち上げと着陸を含む）。')),
      capacityKg: {
        'site-ridge': pub(500, ['astrobotic-griffin']),
        'site-nobile': pub(500, ['astrobotic-griffin']),
        'site-coldtrap': pub(500, ['astrobotic-griffin']),
      },
      reliability: est(0.75, ['astrobotic-pm1', 'sfn-im2', 'spacepolicy-clps'], tx(
        'Chance of reaching the surface. Of NASA’s four commercial lunar deliveries in 2024–2025, three reached the surface (Peregrine did not), but two of those landed on their side; landing on the side is a separate card. NASA called these deliveries “shots on goal” and said a 50-50 success rate would be acceptable.',
        '月面に届く確率。2024〜2025年のNASAの民間月輸送4回のうち、月面に届いたのは3回（Peregrineは届かず）。ただしそのうち2回は横倒しだった（横倒しは別のカード）。NASAはこの輸送を「シュートの数を打つ」方式と呼び、成功率5割でも受け入れられるとしていた。',
      )),
      windowsDay: rule([1000, 1200, 1400]),
    },
    {
      kind: 'launch', id: 'lander-large', name: tx('Large commercial lander', '大型の民間着陸機'),
      description: tx('Plenty of mass to spare and a better landing record, at a higher price.', '質量に大きな余裕があり着陸の実績もよいが、高い。'),
      cost: rule(320000),
      capacityKg: { 'site-ridge': rule(1500), 'site-nobile': rule(1500), 'site-coldtrap': rule(1500) },
      reliability: rule(0.8, tx('Game value: a little better than the medium lander.', 'ゲームの値：中型の着陸機より少しよい。')),
      windowsDay: rule([1000, 1200, 1400]),
      tags: ['lander:large'],
    },

    { kind: 'choice', id: 'lwindow-first', name: tx('First window', '最初の窓'), description: tx('Full schedule score, but a delay can leave you with no launch at all.', '日程の点は満点。ただし遅れると打ち上げられなくなるおそれ。'), cost: rule(0), settings: { targetWindow: rule(0) } },
    { kind: 'choice', id: 'lwindow-second', name: tx('Next window', '次の窓'), description: tx('Half the schedule score, plenty of time for surprises.', '日程の点は半分。想定外に備える時間ができる。'), cost: rule(0), settings: { targetWindow: rule(1) } },

    { kind: 'choice', id: 'dsn-standard', name: tx('Standard booking', '標準の割り当て'), description: tx('Contact whenever Earth is up and an antenna is free.', '地球が見えていてアンテナが空いているときに通信する。'), cost: rule(5000), settings: { networkFactor: rule(1) } },
    { kind: 'choice', id: 'dsn-priority', name: tx('Priority booking', '優先の割り当て'), description: tx('More antenna time while Earth is up.', '地球が見えているあいだ、アンテナの時間を多く確保する。'), cost: rule(20000), settings: { networkFactor: rule(1.5) } },

    { kind: 'choice', id: 'ltest-basic', name: tx('Basic', '最小限'), description: tx('Functional tests only.', '動作確認のみ。'), cost: rule(5000), leadDays: rule(30), settings: { testDepth: rule(1) } },
    {
      kind: 'choice', id: 'ltest-standard', name: tx('Standard', '標準'),
      description: tx('Thermal vacuum testing; VIPER ran 57 hours on its battery in the chamber.', '熱真空試験。VIPERは試験室の中で57時間、電池だけで動いた。'),
      cost: rule(15000), leadDays: rule(60), settings: { testDepth: rule(2) },
    },
    { kind: 'choice', id: 'ltest-full', name: tx('Full', '徹底'), description: tx('Adds egress tests with a full-scale lander mockup.', '実物大の着陸機の模型で、降りる試験も行う。'), cost: rule(30000), leadDays: rule(90), settings: { testDepth: rule(3) } },

    { kind: 'choice', id: 'lprep-minimal', name: tx('Minimal', '最小限'), description: tx('Learn to drive once on the Moon.', '月に着いてから運転を覚える。'), cost: rule(0), settings: { earlyFailureFactorOps: rule(1) } },
    {
      kind: 'choice', id: 'lprep-rehearsal', name: tx('Drive team rehearsals', '運転チームの通し練習'),
      description: tx('Practise the sense–plan–act cycle with real delays before landing.', '着陸前に、実際の遅れを入れて「見る・計画・実行」の手順を練習する。'),
      cost: rule(8000), leadDays: rule(30),
      settings: { earlyFailureFactorOps: rule(0.6) }, tags: ['opsRehearsed'],
    },

    { kind: 'part', id: 'lem-none', subsystem: 'structure', name: tx('No test rover', '予備機なし'), description: tx('Test driving with the flight rover only.', '本番のローバーだけで走行を試す。'), cost: rule(0), massKg: rule(0) },
    {
      kind: 'part', id: 'lem-build', subsystem: 'structure', name: tx('Build a light test rover', '軽い試験用ローバーを作る'),
      description: tx('A copy built to weigh as the rover would on the Moon, for driving tests.', '月面での重さに合わせた複製機で走行を試す。'),
      cost: rule(12000), leadDays: rule(45), massKg: rule(0, tx('Stays on the ground.', '地上に残るので質量に含めない。')),
      tags: ['engineeringModel'],
    },

    { kind: 'choice', id: 'ldrive-steady', name: tx('Steady', '標準'), description: tx('Drive between planned science stations and drill at each.', '計画した観測地点のあいだを走り、各地点で掘る。'), cost: rule(0), settings: { dutyCycle: rule(0.5) } },
    { kind: 'choice', id: 'ldrive-aggressive', name: tx('Aggressive', '積極的'), description: tx('Drive and drill as much as possible; uses power and risks getting stuck.', 'できるだけ走って掘る。電力を使い、はまる危険も増える。'), cost: rule(0), settings: { dutyCycle: rule(0.9) } },
    { kind: 'choice', id: 'ldrive-careful', name: tx('Careful', '慎重'), description: tx('Short drives in well-mapped areas.', 'よく調べた範囲を短く走る。'), cost: rule(0), settings: { dutyCycle: rule(0.25) } },
  ],

  events: [
    {
      id: 'lbudget-cut', phase: 1, name: tx('Budget cut', '予算の削減'),
      story: tx('The programme budget is cut by 10%.', '計画の予算が10%削減された。'),
      probability: rule(0.3),
      protectedIf: { kind: 'setting', key: 'reserveShare', atLeast: 0.1 },
      unprotected: [{ kind: 'resource', resource: 'budget', delta: -50000 }],
      lesson: tx('{agency} had no reserve when the budget was cut.', '{agency}は、予算削減のときに予備費がなかった。'),
      realCase: {
        text: tx('VIPER: its cost passed the level that triggers a continue-or-cancel review, and NASA cancelled the nearly finished rover in July 2024.', 'VIPER：費用が継続か中止かの審査にかかる水準を超え、NASAは完成間近のローバーの中止を2024年7月に発表した。'),
        sources: ['spo-viper'],
      },
    },
    {
      id: 'lpart-delay', phase: 2, name: tx('Instrument delay', '機器の納期遅延'),
      story: tx('An instrument arrives months late.', '科学機器の納入が数か月遅れた。'),
      probability: rule(0.35),
      protectedIf: { kind: 'margin', resource: 'schedule', atLeast: 0.1 },
      unprotected: [{ kind: 'delayDays', days: 60 }],
      lesson: tx('{agency} had no schedule margin when an instrument arrived late.', '{agency}は、機器が遅れたときに日程の余裕がなかった。'),
    },
    {
      id: 'lander-delay', phase: 3, name: tx('Lander delay', '着陸機の遅れ'),
      story: tx('The commercial lander slips by months.', '民間の着陸機の完成が数か月遅れた。'),
      probability: rule(0.4),
      protectedIf: { kind: 'setting', key: 'targetWindow', atLeast: 1 },
      unprotected: [{ kind: 'delayDays', days: 150 }],
      lesson: tx('{agency} aimed at the first window and the lander was late.', '{agency}は最初の窓を狙っていて、着陸機が遅れた。'),
      realCase: {
        text: tx('Griffin: NASA asked for more testing of the lander’s propulsion, and VIPER’s landing slipped from 2023 to 2024 and then later.', 'Griffin：NASAが着陸機の推進系の追加試験を求め、VIPERの着陸は2023年から2024年、さらにその先へ延びた。'),
        sources: ['spo-viper'],
      },
    },
    {
      id: 'ltest-anomaly', phase: 4, name: tx('Test anomaly', '試験での不具合'),
      story: tx('A hidden fault is lurking in the rover.', 'ローバーに隠れた不具合がある。'),
      probability: rule(0.4),
      protectedIf: { kind: 'setting', key: 'testDepth', atLeast: 2 },
      partialIf: { kind: 'hasTag', tag: 'engineeringModel' },
      partial: [{ kind: 'failChance', subsystem: 'cdh', add: 0.1 }],
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.4 }],
      lesson: tx('Light testing let a fault through to the Moon for {agency}.', '{agency}は、試験が薄く不具合を月まで持ち込んだ。'),
    },
    {
      id: 'landing-failure', phase: 4, name: tx('Landing failure', '着陸失敗'),
      story: tx('The lander does not touch down safely.', '着陸機が無事に降りられなかった。'),
      probability: rule(0, tx('Drawn from the chosen lander’s reliability instead of a fixed chance.', '一定の確率ではなく、選んだ着陸機の信頼性から引く。')),
      unprotected: [{ kind: 'missionLost', outcome: 'launchFailure' }],
      lesson: tx('{agency} lost the rover at landing.', '{agency}は、着陸でローバーを失った。'),
      realCase: {
        text: tx('Peregrine (January 2024): a helium pressure control valve failed soon after launch, propellant leaked, and the lander never reached the Moon.', 'Peregrine（2024年1月）：打ち上げ後まもなくヘリウムの圧力制御弁が故障して推進剤が漏れ、着陸機は月に届かなかった。'),
        sources: ['astrobotic-pm1'],
      },
    },
    {
      id: 'lsolar-storm', phase: 5, name: tx('Solar storm', '太陽嵐'),
      story: tx('High-energy particles from a solar flare reach the Moon, which has no magnetic field to shield it.', '太陽フレアの高エネルギー粒子が月に届いた。月には守ってくれる磁場がない。'),
      probability: est(0.62, ['nasa-donki'], tx(
        'Share of 100-day periods in 2014–2025 with at least one solar energetic particle episode in DONKI (378 of 612). See data/donki-sep-2014-2025.json.',
        '2014〜2025年の100日の期間のうち、DONKIに太陽高エネルギー粒子の記録が1回以上ある期間の割合（612のうち378）。data/donki-sep-2014-2025.json を参照。',
      )),
      protectedIf: { kind: 'hasTag', tag: 'opsRehearsed' },
      unprotected: [{ kind: 'scienceFactor', factor: 0.85 }, { kind: 'failChance', subsystem: 'cdh', add: 0.1 }],
      lesson: tx('The same solar storm hit everyone; {agency}’s team was slow to put the rover in safe mode.', '同じ太陽嵐が全機関を襲った。{agency}のチームは、ローバーを安全な状態にするのが遅れた。'),
    },
    {
      id: 'stuck', phase: 5, name: tx('Stuck in soft soil', '柔らかい土にはまる'),
      story: tx('A wheel sinks into loose regolith.', '車輪がやわらかいレゴリスに沈んだ。'),
      probability: rule(0.3),
      partialIf: { kind: 'hasTag', tag: 'engineeringModel' },
      partial: [{ kind: 'durationFactor', factor: 0.85 }],
      unprotected: [{ kind: 'durationFactor', factor: 0.5 }],
      lesson: tx('{agency} had not tested driving in Moon-like gravity and lost weeks getting free.', '{agency}は月の重力に近い条件で走行を試しておらず、抜け出すのに何週間もかかった。'),
    },
    {
      id: 'long-night', phase: 5, name: tx('Longer shadow than planned', '想定より長い影'),
      story: tx('The safe spot falls into shadow for longer than expected.', '安全な待機場所が、想定より長く影に入った。'),
      probability: rule(0.5),
      protectedIf: { kind: 'hasTag', tag: 'nightSurvival' },
      partialIf: { kind: 'hasTag', tag: 'bigBattery' },
      partial: [{ kind: 'durationFactor', factor: 0.85 }],
      unprotected: [{ kind: 'durationFactor', factor: 0.6 }],
      lesson: tx('{agency}’s rover froze in a long shadow: no heaters and a small battery.', '{agency}のローバーは長い影で凍りついた。ヒーターがなく電池も小さかった。'),
    },
    {
      id: 'comm-gap', phase: 5, name: tx('Earth below the horizon', '地球が地平線の下に'),
      story: tx('Earth sets for longer than planned and data piles up.', '地球が想定より長く沈み、データがたまった。'),
      probability: rule(0.4),
      protectedIf: { kind: 'margin', resource: 'downlink', atLeast: 0.5 },
      unprotected: [{ kind: 'scienceFactor', factor: 0.9 }],
      lesson: tx('{agency} could not send everything once Earth rose again.', '{agency}は、地球が昇ってからもデータを送りきれなかった。'),
      realCase: {
        text: tx('NASA’s Inspector General found that demand on the Deep Space Network sometimes exceeds what it can provide by about 40%.', 'NASAの監察官室によると、深宇宙通信網への需要は、ときに供給を約40%上回る。'),
        sources: ['nasa-oig-dsn'],
      },
    },
    {
      id: 'tip-over', phase: 5, name: tx('Landed on its side', '横倒しで着陸'),
      story: tx('The lander touches down but tips over. The rover may not be able to drive off cleanly, and the solar arrays face the wrong way.', '着陸はできたが横倒しになった。ローバーがうまく降りられず、太陽電池も違う方向を向いている。'),
      probability: rule(0.3, tx('Game value. Two of the three commercial landers that reached the Moon in 2024–2025 ended up on their side.', 'ゲームの値。2024〜2025年に月面に届いた民間の着陸機3機のうち、2機が横倒しになった。')),
      partialIf: { kind: 'hasTag', tag: 'lander:large' },
      partial: [{ kind: 'scienceFactor', factor: 0.8 }],
      unprotected: [{ kind: 'scienceFactor', factor: 0.5 }, { kind: 'durationFactor', factor: 0.6 }],
      lesson: tx('{agency}’s lander tipped over, and the rover lost time and science.', '{agency}の着陸機は横倒しになり、ローバーは時間と科学を失った。'),
      realCase: {
        text: tx('IM-2 (March 2025): the lander came down in a crater about 250 m from its target, on its side, and its drill could not dig.', 'IM-2（2025年3月）：着陸機は目標から約250 m離れたクレーターの中に横倒しで降り、ドリルは掘れなかった。'),
        sources: ['sfn-im2'],
      },
    },
    {
      id: 'ice-rich', phase: 5, name: tx('Ice-rich spot', '氷の多い場所'),
      story: tx('The neutron data point to a buried ice-rich layer.', '中性子のデータが、氷の多い層が埋まっていることを示した。'),
      probability: rule(0.35),
      unprotected: [],
      readyIf: { kind: 'hasTag', tag: 'drill' },
      benefit: [{ kind: 'scienceFactor', factor: 1.25 }],
      lesson: tx('{agency} had a drill and could sample the ice-rich layer.', '{agency}はドリルを積んでいて、氷の多い層を掘れた。'),
    },
  ],
};
