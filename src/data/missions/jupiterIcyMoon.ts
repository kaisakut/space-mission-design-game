import type { Mission } from '../types';
import { est, nasa, pub, rule, tx } from '../helpers';

/**
 * Mission 3 (playable): a flagship spacecraft that studies Jupiter's icy moon Europa.
 *
 * Modelled on NASA's Europa Clipper (mass, solar power at Jupiter, radiation vault, about 50 flybys,
 * Falcon Heavy launch with a 5.5-year cruise). Alternative tours, most instrument masses and prices are
 * game values: the sources describe one spacecraft, not a menu.
 */

const FLYBY_NOTE = tx(
  'Close passes of Europa where the instrument can observe. Europa Clipper’s tour has 49 science flybys.',
  '機器が観測できるエウロパへの接近の回数。エウロパ・クリッパーの計画では科学用の接近が49回。',
);
const DATA_NOTE = tx('Game value for the standard observation plan; the plan you pick scales it.', '標準の観測計画でのゲームの値。選んだ計画に応じて増減する。');
const SUN_NOTE = tx('Sunlight at Jupiter is only about 4% of what Earth receives.', '木星での日射は、地球が受ける量の約4%しかない。');
const CONTACT_NOTE = tx('Game value for Deep Space Network passes per day, averaged over the tour.', '深宇宙通信網との1日あたりの通信時間の、観測期間を通した平均（ゲームの値）。');

export const jupiterIcyMoon: Mission = {
  id: 'jupiter-icy-moon',
  view: {
    kind: 'jupiterSystem',
    paths: { 'tour-flybys': 'flybys', 'tour-europa-orbit': 'europaOrbit', 'tour-ganymede': 'ganymede' },
  },
  name: tx('Icy Moon Explorer at Jupiter', '木星の氷衛星探査機'),
  summary: tx(
    'Send a spacecraft to Jupiter to look for an ocean under Europa’s ice, through the harshest radiation of any planet.',
    '木星に探査機を送り、エウロパの氷の下に海があるかを調べる。どの惑星よりも強い放射線の中を飛ぶ。',
  ),
  difficulty: 'advanced',
  playable: true,
  budgetKUSD: rule(4500000, tx('Game value for designing, building and launching. For comparison, NASA expects to invest about $5.2 billion over Europa Clipper’s full life, operations included.', '設計・製作・打ち上げの分のゲームの値。比較のため：NASAはエウロパ・クリッパーの全期間（運用を含む）に約52億ドルを投じる見込み。')),
  opsDays: nasa(1250, ['jpl-clipper-quickfacts'], tx('Europa flybys begin in early 2031 and the prime mission ends in June 2034: about 3.4 years.', 'エウロパへの接近は2031年初めに始まり、本来の任務は2034年6月に終わる：約3.4年。')),
  bus: {
    massKg: est(5448, ['jpl-clipper-quickfacts', 'wikipedia-europa-clipper'], tx('Europa Clipper’s launch mass of about 5,800 kg (with about 2,750 kg of propellant, JPL) minus its 352 kg of instruments; the game’s vault and arrays are counted inside it.', 'エウロパ・クリッパーの打ち上げ質量約5,800 kg（推進剤約2,750 kgを含む、JPL）から観測機器352 kgを除いた値。ゲームでは放射線の保護容器と太陽電池もこの中に含める。')),
    powerW: rule(450, tx('Game value for the bus on average, including heaters.', 'ヒーターを含む本体の平均のゲームの値。')),
    cost: rule(2200000, tx('Game value; the sources list no breakdown.', 'ゲームの値（資料に内訳の記載なし）。')),
    devDays: rule(1500, tx('Game value: about four years from concept to launch readiness.', 'ゲームの値：構想から打ち上げ準備完了まで約4年。')),
    maxMassKg: rule(7000),
    failPerYear: rule(0.04),
  },
  rules: {
    scienceUnit: tx('close-pass observations', '件の接近観測'),
    budgetFullLeftShare: rule(0.3, tx('Game value, set so that adding one small safeguard to the standard design still earns full budget points.', 'ゲームの値。標準の設計に小さな備えを1つ足しても満点のままになるように決めた。')),
    scienceFullScore: rule(300, tx('Science value for the full science score.', '科学価値の満点の基準。')),
    earlyFailureByTestDepth: rule([0.15, 0.07, 0.03], tx('Game values: chance of a fatal fault in the early cruise, by test depth.', '試験の深さごとの、航行の初期に致命的な故障が出る確率（ゲームの値）。')),
    changeFactors: rule([1.5, 3, 6]),
    changeMinKUSD: rule(30000, tx('Redesign work even when the new part costs nothing.', '部品が無料でも、設計のやり直しに費用がかかる。')),
    changeDelayDaysPerPhase: rule(45),
  },
  outcomeLabels: {
    orbitFailure: tx('Lost during cruise', '航行中に喪失'),
  },
  primary: {
    id: 'ocean', name: tx('Look for the ocean', '海を探す'),
    description: tx('Gather enough close observations to tell whether an ocean lies under the ice.', '氷の下に海があるかを判断できるだけの接近観測を集める。'),
    points: rule(35), rule: { kind: 'science', atLeast: 35, partialAtLeast: 15 },
  },
  secondary: [
    {
      id: 'plumes', name: tx('Sample plumes', '噴出物を調べる'),
      description: tx('Analyse material thrown out from Europa (needs an in-situ instrument).', 'エウロパから噴き出た物質を分析する（その場で測る機器が必要）。'),
      points: rule(5), rule: { kind: 'hasTag', tag: 'insitu' }, chosenBy: 'goal:plumes',
    },
    {
      id: 'shell', name: tx('Sound the ice shell', '氷の殻を透かす'),
      description: tx('Measure the ice thickness with radar.', 'レーダーで氷の厚さを測る。'),
      points: rule(5), rule: { kind: 'hasTag', tag: 'radar' }, chosenBy: 'goal:shell',
    },
    {
      id: 'full-tour', name: tx('Complete the tour', '観測期間を完走'),
      description: tx('Keep working to the end of the prime mission.', '本来の任務の最後まで観測を続ける。'),
      points: rule(5), rule: { kind: 'survive' }, chosenBy: 'goal:full',
    },
  ],
  rubric: { primary: rule(35), secondary: rule(15), science: rule(30), budget: rule(10), schedule: rule(10) },

  slots: [
    {
      id: 'secondary', icon: 'target', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Secondary objectives', '副目的'),
      help: tx('Each one adds points but also requirements. Agencies chasing the same one split its points.', '1つごとに加点されますが、要求も増えます。同じ副目的を狙う機関が多いと得点が割れます。'),
      options: ['jsec-none', 'jsec-plumes', 'jsec-shell', 'jsec-full'], multi: { min: 0, max: 2, noneFirst: true },
    },
    {
      id: 'tour', icon: 'route', default: 'tour-flybys', phase: 1, role: 'lead', changeKind: 'hardware',
      label: tx('Tour design', '観測の軌道'),
      help: tx('How the spacecraft meets Europa decides how much it sees and how much radiation it takes.', 'エウロパへの近づき方で、観測できる量と浴びる放射線の量が決まります。'),
      options: ['tour-flybys', 'tour-europa-orbit', 'tour-ganymede'],
    },
    {
      id: 'budget-split', icon: 'coins', level: { by: 'settings.reserveShare', label: tx('Reserve', '予備費') }, default: 'jsplit-balanced', phase: 1, role: 'lead', changeKind: 'plan',
      label: tx('Budget split', '予算の配分'),
      help: tx('How much to keep in reserve for surprises.', '想定外に備えて、予備費をどれだけ残すか。'),
      options: ['jsplit-balanced', 'jsplit-lean', 'jsplit-safe'],
    },
    {
      id: 'instruments', icon: 'eye', default: ['jinst-eis', 'jinst-reason', 'jinst-maspex'], phase: 2, role: 'science', changeKind: 'hardware',
      label: tx('Science instruments', '科学機器'),
      help: tx('Europa Clipper carries nine. Pick up to four; each adds mass, power, data and cost.', 'エウロパ・クリッパーは9つ積んでいます。ここでは4つまで。機器ごとに質量・電力・データ・費用が増えます。'),
      options: ['jinst-eis', 'jinst-mise', 'jinst-reason', 'jinst-maspex', 'jinst-suda', 'jinst-ecm'], multi: { min: 1, max: 4 },
    },
    {
      id: 'power', icon: 'panel', level: { by: 'generatesW+rtgW', label: tx('Power', '発電') }, default: 'jpwr-arrays', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Power', '電源'),
      help: tx('Sunlight at Jupiter is weak: arrays must be huge, or a nuclear generator can help.', '木星では日射が弱いため、太陽電池を巨大にするか、原子力電池で補います。'),
      options: ['jpwr-small', 'jpwr-arrays', 'jpwr-hybrid'],
    },
    {
      id: 'vault', icon: 'layers', level: { by: 'tags', label: tx('Shielding', '遮へい') }, default: 'jvault-standard', phase: 2, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Radiation vault', '放射線の保護容器'),
      help: tx('Electronics sit inside a thick-walled vault, an approach first used by Juno.', '電子機器を厚い壁の容器に入れて守ります。ジュノーで初めて使われた方法です。'),
      options: ['jvault-thin', 'jvault-standard', 'jvault-thick'],
    },
    {
      id: 'radio', icon: 'antenna', level: { by: 'downlinkMBPerMin', label: tx('Speed', '速さ') }, default: 'jcomm-x', phase: 2, role: 'powerComms', changeKind: 'hardware',
      label: tx('Radio', '無線'),
      help: tx('A 3 m high-gain antenna sends data across about 800 million km.', '直径3 mの高利得アンテナで、約8億 km先の地球へデータを送ります。'),
      options: ['jcomm-x', 'jcomm-ka'],
    },
    {
      id: 'launch', icon: 'rocket', default: 'jlv-heavy', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Launch and route', '打ち上げと経路'),
      help: tx('A cheaper rocket needs swing-bys of Mars and Earth on the way, which take longer.', '安いロケットでは途中で火星と地球のスイングバイが必要になり、時間がかかります。'),
      options: ['jlv-heavy', 'jlv-direct'],
    },
    {
      id: 'window', icon: 'calendar', level: { by: 'settings.targetWindow', label: tx('Time in hand', '余裕') }, default: 'jwindow-first', phase: 3, role: 'lead', changeKind: 'plan',
      label: tx('Launch window', '打ち上げ窓'),
      help: tx('Earth and Jupiter line up for the trip about every 13 months (about 400 days). Missing a window costs a long wait.', '地球と木星が行きやすい並びになるのは約13か月（約400日）ごと。窓を逃すと長く待つことになります。'),
      options: ['jwindow-first', 'jwindow-second'],
    },
    {
      id: 'ground', icon: 'dish', level: { by: 'settings.networkFactor+settings.highLatStation', label: tx('Contact', '通信') }, default: 'jdsn-standard', phase: 3, role: 'powerComms', changeKind: 'plan',
      label: tx('Deep Space Network time', '深宇宙通信網の時間'),
      help: tx('The 34 m and 70 m antennas are shared by many missions.', '34 mと70 mのアンテナは、多くのミッションで共有しています。'),
      options: ['jdsn-standard', 'jdsn-priority'],
    },
    {
      id: 'testing', icon: 'clipboard', level: { by: 'settings.testDepth', label: tx('Depth', '深さ') }, default: 'jtest-basic', phase: 4, role: 'spacecraft', changeKind: 'plan',
      label: tx('Test campaign', '試験の深さ'),
      help: tx('Deeper testing finds faults before launch but uses time and money.', '試験を厚くすると打ち上げ前に不具合を見つけられますが、時間と費用を使います。'),
      options: ['jtest-basic', 'jtest-standard', 'jtest-full'],
    },
    {
      id: 'ops-prep', icon: 'headset', level: { by: 'costed', label: tx('Preparation', '準備') }, default: 'jprep-minimal', phase: 4, role: 'lead', changeKind: 'plan',
      label: tx('Operations readiness', '運用の準備'),
      help: tx('Each flyby is planned weeks ahead; signals take over half an hour each way.', '接近は数週間前から計画します。信号は片道30分以上かかります。'),
      options: ['jprep-minimal', 'jprep-rehearsal'],
    },
    {
      id: 'model', icon: 'box', level: { by: 'costed', label: tx('Preparation', '準備') }, default: 'jem-none', phase: 4, role: 'spacecraft', changeKind: 'hardware',
      label: tx('Radiation test parts', '放射線試験用の部品'),
      help: tx('Extra copies of parts to test in a radiation beam before launch.', '打ち上げ前に放射線ビームで試すための、予備の部品。'),
      options: ['jem-none', 'jem-build'],
    },
    {
      id: 'ops-plan', icon: 'eye', level: { by: 'settings.dutyCycle', label: tx('Observing', '観測'), style: 'arc' }, default: 'jops-careful', phase: 5, role: 'science', changeKind: 'plan',
      label: tx('Observation plan', '観測計画'),
      help: tx('Observing on more flybys gathers more data but needs more power and downlink.', '多くの接近で観測するほどデータは増えますが、電力と通信が要ります。'),
      options: ['jops-steady', 'jops-aggressive', 'jops-careful'],
    },
  ],

  options: [
    { kind: 'choice', id: 'jsec-none', icon: 'none', name: tx('None', 'なし'), description: tx('Focus on the primary objective.', '主目的に集中する。'), cost: rule(0) },
    { kind: 'choice', id: 'jsec-plumes', icon: 'flask', name: tx('Sample plumes', '噴出物を調べる'), description: tx('Needs MASPEX or SUDA.', 'MASPEXかSUDAが必要。'), cost: rule(0), tags: ['goal:plumes'] },
    { kind: 'choice', id: 'jsec-shell', icon: 'radar', name: tx('Sound the ice shell', '氷の殻を透かす'), description: tx('Needs the REASON radar.', 'REASONレーダーが必要。'), cost: rule(0), tags: ['goal:shell'] },
    { kind: 'choice', id: 'jsec-full', icon: 'hourglass', name: tx('Complete the tour', '観測期間を完走'), description: tx('Needs to survive years of radiation.', '何年もの放射線に耐える必要がある。'), cost: rule(0), tags: ['goal:full'] },

    {
      kind: 'orbit', id: 'tour-flybys', icon: 'route', name: tx('Many Europa flybys from Jupiter orbit', '木星を回りながらエウロパに何度も接近'),
      description: tx('Europa Clipper’s approach: dip in for a flyby, then leave the worst radiation to recover.', 'エウロパ・クリッパーの方法。接近してはすぐ離れ、強い放射線から抜けて回復する。'),
      cost: rule(0),
      solarFactor: nasa(0.04, ['jpl-clipper-presskit'], SUN_NOTE),
      contactMinPerDay: rule(480, CONTACT_NOTE),
      science: { remote: nasa(49, ['jpl-clipper-presskit'], FLYBY_NOTE), radar: nasa(49, ['jpl-clipper-presskit'], FLYBY_NOTE), insitu: nasa(49, ['jpl-clipper-presskit'], FLYBY_NOTE), field: nasa(49, ['jpl-clipper-presskit'], FLYBY_NOTE) },
      tags: ['tour'],
    },
    {
      kind: 'orbit', id: 'tour-europa-orbit', icon: 'route', name: tx('Orbit Europa', 'エウロパを周回'),
      description: tx('Continuous observation, but deep in the radiation belts all the time. Studied and rejected for Clipper.', '連続して観測できるが、常に放射線帯の奥にいる。クリッパーでは検討の末に見送られた。'),
      cost: rule(150000, tx('Game value for the extra propellant and the capture manoeuvre.', '追加の推進剤と周回への投入の分のゲームの値。')),
      solarFactor: nasa(0.04, ['jpl-clipper-presskit'], SUN_NOTE),
      contactMinPerDay: rule(480, CONTACT_NOTE),
      science: {
        remote: rule(140, tx('Game value: continuous coverage counted as close passes.', 'ゲームの値。連続観測を接近の回数に換算した。')),
        radar: rule(140), insitu: rule(100), field: rule(140),
      },
    },
    {
      kind: 'orbit', id: 'tour-ganymede', icon: 'route', name: tx('Ganymede tour with two Europa flybys', 'ガニメデ中心の観測（エウロパへは2回）'),
      description: tx('Far gentler radiation, but Europa only twice; other icy moons count less.', '放射線ははるかに弱いが、エウロパには2回だけ。ほかの氷衛星の観測は価値が低い。'),
      cost: rule(0),
      solarFactor: nasa(0.04, ['jpl-clipper-presskit'], SUN_NOTE),
      contactMinPerDay: rule(480, CONTACT_NOTE),
      science: { remote: rule(30), radar: rule(30), insitu: rule(20), field: rule(30) },
      tags: ['tour', 'radiation:low'],
    },

    { kind: 'choice', id: 'jsplit-balanced', icon: 'coins', name: tx('Balanced (10% reserve)', '標準（予備費10%）'), description: tx('The reserve also covers design surprises, so only half of it can go to a budget cut; the rest is made up by dropping observations.', '予備費は設計の想定外にも使うので、予算削減に回せるのは半分。残りは観測を減らして埋める。'), cost: rule(0), settings: { reserveShare: rule(0.1) } },
    { kind: 'choice', id: 'jsplit-lean', icon: 'coins', name: tx('Lean (0% reserve)', '切り詰め（予備費0%）'), description: tx('More money for hardware, none for surprises.', '機器に回せる分は多いが、想定外に弱い。'), cost: rule(0), settings: { reserveShare: rule(0) } },
    { kind: 'choice', id: 'jsplit-safe', icon: 'coins', name: tx('Safe (20% reserve)', '安全重視（予備費20%）'), description: tx('Absorbs a budget cut in full. NASA projects hold 20–30% in reserve during design. Less to spend on hardware.', '予算削減を全部吸収できる。NASAの計画は設計中に20〜30%の予備費を持つ。機器に回せる分は減る。'), cost: rule(0), settings: { reserveShare: pub(0.2, ['jpl-reserves'], tx('JPL keeps 20% of the cost to go as reserve from CDR to launch (30% at proposal). JPL’s rule is a share of the cost to go; the game applies it to the whole budget. That this reserve absorbs a budget cut in full is the game’s rule.', 'JPLは詳細設計審査から打ち上げまで、残りの費用の20%を予備費として持つ（提案時は30%）。JPLの基準は残りの費用に対する割合。ゲームでは予算の総額に対する割合として扱う。予算削減を全部吸収できるとしたのはゲームの決めごと。')) } },

    { kind: 'part', id: 'jinst-eis', icon: 'eye', subsystem: 'payload', name: tx('Cameras (EIS)', 'カメラ（EIS）'), description: tx('Wide and narrow cameras map the surface; down to about 1 m per pixel from 100 km.', '広角と狭角のカメラで地表を撮る。100 kmから1画素約1 m。'), cost: rule(60000), massKg: rule(40), powerW: rule(30), dataMBPerDay: rule(800, DATA_NOTE), scienceWeight: rule(2), observes: 'remote' },
    { kind: 'part', id: 'jinst-mise', icon: 'thermo', subsystem: 'payload', name: tx('Infrared spectrometer (MISE)', '赤外分光計（MISE）'), description: tx('Maps the chemical fingerprints of salts and organics on the surface.', '地表の塩や有機物の化学的な指紋を地図にする。'), cost: rule(60000), massKg: rule(65), powerW: rule(40), dataMBPerDay: rule(600, DATA_NOTE), scienceWeight: rule(2), observes: 'remote' },
    { kind: 'part', id: 'jinst-reason', icon: 'radar', subsystem: 'payload', name: tx('Ice-penetrating radar (REASON)', '氷を透かすレーダー（REASON）'), description: tx('Sounds the ice shell and looks for water within it.', '氷の殻を透かし、中の水を探す。'), cost: rule(80000), massKg: rule(70), powerW: est(30, ['nasa-clipper-nas-2017'], tx('Radiated power is 10–30 W (game takes the top of the range).', '送信電力は10〜30 W（ゲームでは上限をとる）。')), dataMBPerDay: rule(1000, DATA_NOTE), scienceWeight: rule(3), observes: 'radar', tags: ['radar'] },
    { kind: 'part', id: 'jinst-maspex', icon: 'flask', subsystem: 'payload', name: tx('Mass spectrometer (MASPEX)', '質量分析計（MASPEX）'), description: tx('Sniffs Europa’s thin atmosphere and any plume gas.', 'エウロパの薄い大気と噴出したガスを嗅ぎ分ける。'), cost: rule(70000), massKg: rule(25), powerW: rule(40), dataMBPerDay: rule(100, DATA_NOTE), scienceWeight: rule(2.5), observes: 'insitu', tags: ['insitu'] },
    { kind: 'part', id: 'jinst-suda', icon: 'dust', subsystem: 'payload', name: tx('Dust analyser (SUDA)', '塵の分析器（SUDA）'), description: tx('Analyses dust knocked off the surface and grains from plumes.', '地表から飛ばされた塵と、噴出物の粒を分析する。'), cost: rule(40000), massKg: rule(15), powerW: rule(20), dataMBPerDay: rule(50, DATA_NOTE), scienceWeight: rule(2), observes: 'insitu', tags: ['insitu'] },
    {
      kind: 'part', id: 'jinst-ecm', icon: 'magnet', subsystem: 'payload', name: tx('Magnetometer (ECM)', '磁力計（ECM）'), description: tx('Senses the ocean through how it disturbs Jupiter’s magnetic field.', '木星の磁場の乱れ方から、海の存在を感じ取る。'),
      cost: rule(30000),
      massKg: nasa(31, ['nasa-clipper-instruments'], tx('Including the fluxgate sensors, the boom and the electronics.', '磁力センサー・伸展ブーム・電子回路を含む。')),
      powerW: nasa(16.2, ['nasa-clipper-instruments'], tx('During science operations.', '科学観測中。')),
      dataMBPerDay: rule(20, DATA_NOTE), scienceWeight: rule(1.5), observes: 'field',
    },

    {
      kind: 'part', id: 'jpwr-small', icon: 'panel', subsystem: 'power', name: tx('Smaller solar arrays', '小さめの太陽電池'),
      description: tx('Four-fifths of Clipper’s array area: lighter and cheaper, little spare power.', 'クリッパーの5分の4の面積。軽く安いが、電力の余裕は少ない。'),
      cost: rule(70000), massKg: rule(-100, tx('Lighter than the standard arrays counted in the bus mass.', '本体の質量に含めた標準の太陽電池より軽い分。')),
      generatesW: est(14000, ['jpl-clipper-spacecraft', 'jpl-clipper-presskit'], tx('Four-fifths of the standard arrays (700 W at Jupiter ÷ 0.04, near Earth).', '標準の太陽電池（木星で700 W ÷ 0.04、地球近くの値）の5分の4。')),
      failPerYear: rule(0.02),
    },
    {
      kind: 'part', id: 'jpwr-arrays', icon: 'wings', subsystem: 'power', name: tx('Huge solar arrays (Clipper size)', '巨大な太陽電池（クリッパーと同じ）'),
      description: tx('Over 30 m tip to tip; at least 700 W at Jupiter for the whole mission.', '端から端まで30 m以上。木星でもミッションの間ずっと700 W以上。'),
      cost: rule(100000), massKg: rule(0, tx('Counted in the bus mass.', '本体の質量に含む。')),
      generatesW: est(17500, ['jpl-clipper-spacecraft', 'jpl-clipper-presskit'], tx('Designed for at least 700 W at Jupiter, where sunlight is about 4%: 700 ÷ 0.04, near Earth.', '日射が約4%の木星で700 W以上を出す設計：700 ÷ 0.04（地球近くの値）。')),
      failPerYear: rule(0.02),
    },
    {
      kind: 'part', id: 'jpwr-hybrid', icon: 'atom', subsystem: 'power', name: tx('Smaller arrays + two nuclear generators', '小さめの太陽電池＋原子力電池2基'),
      description: tx('Steady power anywhere, but plutonium is scarce and the safety review is long.', 'どこでも安定した電力。ただしプルトニウムは貴重で、安全審査が長い。'),
      cost: rule(300000, tx('Game value including the safety review.', '安全審査を含むゲームの値。')),
      leadDays: rule(180, tx('Game value for the launch safety approval.', '打ち上げの安全承認の分のゲームの値。')),
      massKg: est(-7, ['nasa-rps'], tx('Two MMRTGs of 46.5 kg each, minus the 100 kg saved on smaller arrays.', 'MMRTG 1基46.5 kgを2基、小さめの太陽電池で減る100 kgを差し引く。')),
      generatesW: est(14000, ['jpl-clipper-spacecraft'], tx('Same arrays as the smaller option.', '小さめの太陽電池と同じ。')),
      rtgW: est(220, ['nasa-rps'], tx('Two MMRTGs of 110 W each at launch.', '打ち上げ時110 WのMMRTGを2基。')),
      failPerYear: rule(0.01),
    },

    { kind: 'part', id: 'jvault-thin', icon: 'layers', subsystem: 'protection', name: tx('Thin vault', '薄い保護容器'), description: tx('Saves mass; electronics wear out faster.', '質量を節約できるが、電子機器の劣化が早い。'), cost: rule(10000), massKg: rule(-80, tx('Lighter than the standard vault counted in the bus mass.', '本体の質量に含めた標準の容器より軽い分。')) },
    {
      kind: 'part', id: 'jvault-standard', icon: 'layers', subsystem: 'protection', name: tx('Clipper vault (9.2 mm aluminium–zinc)', 'クリッパーと同じ容器（厚さ9.2 mmのアルミ亜鉛合金）'),
      description: tx('Walls of aluminium–zinc alloy about 9.2 mm thick around the electronics.', '電子機器を、厚さ約9.2 mmのアルミ亜鉛合金の壁で囲む。'),
      cost: rule(30000), massKg: rule(0, tx('Counted in the bus mass.', '本体の質量に含む。')), tags: ['vault'],
    },
    {
      kind: 'part', id: 'jvault-thick', icon: 'layers', subsystem: 'protection', name: tx('Thicker vault and spot shields', '厚い容器と部分的な遮へい'),
      description: tx('Extra tantalum shielding on the most sensitive parts.', '特に弱い部品にタンタルの遮へいを足す。'),
      cost: rule(60000), massKg: rule(120), tags: ['vault', 'vault-thick'],
    },

    { kind: 'part', id: 'jcomm-x', icon: 'dish', subsystem: 'comms', name: tx('X-band high-gain antenna (3 m)', 'Xバンドの高利得アンテナ（3 m）'), description: tx('The proven choice.', '実績のある選択。'), cost: rule(30000), massKg: rule(0, tx('Counted in the bus mass.', '本体の質量に含む。')), powerW: rule(100), downlinkMBPerMin: rule(5, tx('Game value for the data rate from Jupiter.', '木星からのデータ速度のゲームの値。')) },
    { kind: 'part', id: 'jcomm-ka', icon: 'antenna', subsystem: 'comms', name: tx('Add Ka-band', 'Kaバンドを追加'), description: tx('Several times the data rate, at a cost in mass and power.', 'データ速度は数倍になるが、質量と電力が増える。'), cost: rule(60000), massKg: rule(20), powerW: rule(130), downlinkMBPerMin: rule(12, tx('Game value: about three times X-band.', 'ゲームの値：Xバンドの約3倍。')) },

    {
      kind: 'launch', id: 'jlv-heavy', icon: 'rocket', name: tx('Heavy rocket with Mars and Earth swing-bys', '大型ロケット＋火星・地球スイングバイ'),
      description: tx('Europa Clipper’s route on a Falcon Heavy: 5½ years to Jupiter.', 'ファルコン・ヘビーでのエウロパ・クリッパーの経路。木星まで5年半。'),
      cost: nasa(178000, ['nasa-clipper-launch-contract'], tx('Europa Clipper’s Falcon Heavy launch contract: about US$178 million.', 'エウロパ・クリッパーのファルコン・ヘビー打ち上げ契約：約1億7800万ドル。')),
      capacityKg: { 'tour-flybys': rule(6500), 'tour-europa-orbit': rule(6500), 'tour-ganymede': rule(6500) },
      reliability: rule(0.97), windowsDay: rule([1700, 2100, 2500]),
    },
    {
      kind: 'launch', id: 'jlv-direct', icon: 'rocket', name: tx('Super-heavy rocket, direct route', '超大型ロケットで直行'),
      description: tx('Much faster to Jupiter, so fewer years of wear on the way, and more mass to spare; very expensive.', '木星までずっと早く、途中で傷む年数が少ない。質量の余裕も大きいが、非常に高い。'),
      cost: nasa(876000, ['nasa-oig-europa'], tx('NASA’s 2019 estimate: an SLS launch would cost US$876 million, a commercial rocket up to US$450 million (NASA Inspector General IG-19-019, Table 3). The White House said the same year that SLS costs over US$2 billion per launch.', 'NASAの2019年の見積もり：SLSでの打ち上げは8億7600万ドル、商用ロケットは最大4億5000万ドル（NASA監察官室 IG-19-019、表3）。ホワイトハウスは同じ年に、SLSは1回あたり20億ドル超とした。')), capacityKg: { 'tour-flybys': rule(9000), 'tour-europa-orbit': rule(9000), 'tour-ganymede': rule(9000) },
      reliability: rule(0.95), windowsDay: rule([1700, 2100, 2500]), tags: ['direct'],
    },

    { kind: 'choice', id: 'jwindow-first', icon: 'calendar', name: tx('First window', '最初の窓'), description: tx('Full schedule score. A delay means waiting about 400 days for the planets to line up again.', '日程の点は満点。遅れると、惑星の並びがまた合うまで約400日待つ。'), cost: rule(0), settings: { targetWindow: rule(0) } },
    { kind: 'choice', id: 'jwindow-second', icon: 'calendar', name: tx('Next window (about 400 days later)', '次の窓（約400日後）'), description: tx('Plan for the next window: half the schedule score, but about 400 more days for surprises.', '次の窓に合わせて計画する。日程の点は半分だが、想定外に備える時間が約400日増える。'), cost: rule(0), settings: { targetWindow: rule(1) } },

    { kind: 'choice', id: 'jdsn-standard', icon: 'dish', name: tx('Standard booking', '標準の割り当て'), description: tx('Share the antennas with other missions.', 'ほかのミッションとアンテナを分け合う。'), cost: rule(20000), settings: { networkFactor: rule(1) } },
    { kind: 'choice', id: 'jdsn-priority', icon: 'dish', name: tx('Priority booking', '優先の割り当て'), description: tx('More 70 m antenna time around each flyby.', '接近のたびに70 mアンテナの時間を多く確保する。'), cost: rule(80000), settings: { networkFactor: rule(1.5) } },

    { kind: 'choice', id: 'jtest-basic', icon: 'clipboard', name: tx('Basic', '最小限'), description: tx('Functional tests only.', '動作確認のみ。'), cost: rule(20000), leadDays: rule(60), settings: { testDepth: rule(1) } },
    { kind: 'choice', id: 'jtest-standard', icon: 'clipboard', name: tx('Standard', '標準'), description: tx('Vibration, thermal vacuum and solar-array deployment tests.', '振動・熱真空・太陽電池の展開の試験。'), cost: rule(60000), leadDays: rule(120), settings: { testDepth: rule(2) } },
    { kind: 'choice', id: 'jtest-full', icon: 'clipboard', name: tx('Full', '徹底'), description: tx('Adds whole-spacecraft radiation and end-to-end flyby rehearsals.', '機体全体の放射線試験と、接近観測の通し試験も行う。'), cost: rule(120000), leadDays: rule(200), settings: { testDepth: rule(3) } },

    { kind: 'choice', id: 'jprep-minimal', icon: 'headset', name: tx('Minimal', '最小限'), description: tx('Plan flybys as they come.', '接近のたびに計画を立てる。'), cost: rule(0), settings: { earlyFailureFactorOps: rule(1) } },
    { kind: 'choice', id: 'jprep-rehearsal', icon: 'headset', name: tx('Flyby rehearsals', '接近観測の通し練習'), description: tx('Rehearse the flyby sequence and recovery from safe mode.', '接近の手順と、セーフモードからの復帰を練習する。'), cost: rule(25000), leadDays: rule(60), settings: { earlyFailureFactorOps: rule(0.6) }, tags: ['opsRehearsed'] },

    { kind: 'part', id: 'jem-none', icon: 'none', subsystem: 'structure', name: tx('No spare parts', '予備なし'), description: tx('Test the flight parts only.', '本番の部品だけで試験する。'), cost: rule(0), massKg: rule(0) },
    { kind: 'part', id: 'jem-build', icon: 'boxes', subsystem: 'structure', name: tx('Spare parts for radiation tests', '放射線試験用の予備部品'), description: tx('Find weak transistors before launch, not at Jupiter.', '弱いトランジスタを、木星ではなく打ち上げ前に見つける。'), cost: rule(40000), leadDays: rule(60), massKg: rule(0, tx('Stays on the ground.', '地上に残るので質量に含めない。')), tags: ['engineeringModel'] },

    { kind: 'choice', id: 'jops-steady', icon: 'eye', name: tx('Steady', '標準'), description: tx('Observe on about half of the flybys.', '接近の約半分で観測する。'), cost: rule(0), settings: { dutyCycle: rule(0.5) } },
    { kind: 'choice', id: 'jops-aggressive', icon: 'eye', name: tx('Aggressive', '積極的'), description: tx('Observe on nearly every flyby. Hard on power and downlink, and instruments wear faster in the radiation belts.', 'ほぼすべての接近で観測する。電力と通信に負担がかかり、放射線帯で機器が劣化しやすい。'), cost: rule(0), settings: { dutyCycle: rule(0.9) } },
    { kind: 'choice', id: 'jops-careful', icon: 'eye', name: tx('Careful', '慎重'), description: tx('Observe on about a quarter of the flybys.', '接近の約4分の1だけで観測する。'), cost: rule(0), settings: { dutyCycle: rule(0.25) } },
  ],

  events: [
    {
      id: 'jbudget-cut', phase: 1, name: tx('Budget cut', '予算の削減'),
      story: tx('The programme budget is cut by 10%.', '計画の予算が10%削減された。'),
      probability: rule(0.35),
      // A 20% reserve absorbs the cut (JPL keeps 20–30% during design); 10% absorbs half and the rest is
      // found by descoping; with no reserve the whole cut is taken from the hardware and the operations.
      protectedIf: { kind: 'setting', key: 'reserveShare', atLeast: 0.2 },
      partialIf: { kind: 'setting', key: 'reserveShare', atLeast: 0.1 },
      partial: [{ kind: 'resource', resource: 'budget', delta: -225000 }, { kind: 'scienceFactor', factor: 0.9 }],
      unprotected: [{ kind: 'resource', resource: 'budget', delta: -450000 }, { kind: 'scienceFactor', factor: 0.75 }],
      lesson: tx('{agency} had no reserve when the budget was cut.', '{agency}は、予算削減のときに予備費がなかった。'),
    },
    {
      id: 'jtransistors', phase: 2, name: tx('Weak transistors found', '弱いトランジスタの発覚'),
      story: tx('Some transistors used all over the spacecraft may fail at lower radiation than expected. Replacing them would miss the launch window; testing them takes months.', '機体じゅうに使ったトランジスタが、想定より弱い放射線で壊れるおそれがわかった。交換すれば打ち上げ窓を逃し、試験には何か月もかかる。'),
      probability: rule(0.4),
      protectedIf: { kind: 'any', of: [{ kind: 'margin', resource: 'schedule', atLeast: 0.1 }, { kind: 'hasTag', tag: 'engineeringModel' }] },
      partialIf: { kind: 'hasTag', tag: 'vault-thick' },
      partial: [{ kind: 'failChance', subsystem: 'cdh', add: 0.03 }],
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.1 }],
      lesson: tx('{agency} had neither spare parts to test nor time to spare, and flew with the risk.', '{agency}には試験用の予備部品も日程の余裕もなく、危険を抱えたまま出発した。'),
      realCase: {
        who: tx('Europa Clipper', 'Europa Clipper'),
        year: '2024',
        text: tx('Europa Clipper (2024): the problem was reported in May. After about four months of round-the-clock testing, the team concluded the parts would degrade near Europa but recover between flybys, and on 9 September NASA approved the October launch.', 'Europa Clipper（2024年）：5月に問題が報告された。約4か月の昼夜を問わない試験で、部品はエウロパの近くで劣化しても接近の間に回復すると結論し、9月9日にNASAが10月の打ち上げを承認した。'),
        sources: ['nasa-clipper-switches', 'ap-clipper-cleared'],
      },
    },
    {
      id: 'jlaunch-slip', phase: 3, name: tx('Rocket delay', 'ロケットの遅れ'),
      story: tx('The launch vehicle slips by months.', 'ロケットの準備が数か月遅れた。'),
      probability: rule(0.3),
      protectedIf: { kind: 'setting', key: 'targetWindow', atLeast: 1 },
      unprotected: [{ kind: 'delayDays', days: 300 }],
      lesson: tx('{agency} aimed at the first window and the rocket was late.', '{agency}は最初の窓を狙っていて、ロケットが遅れた。'),
      realCase: {
        who: tx('Psyche', 'Psyche'), year: '2022',
        text: tx('Psyche: late flight software and test equipment made it miss its 2022 launch window.', 'Psyche：飛行ソフトと試験設備の遅れで2022年の打ち上げ窓を逃した。'),
        sources: ['nasa-psyche-irb'],
      },
    },
    {
      id: 'jtest-anomaly', phase: 4, name: tx('Test anomaly', '試験での不具合'),
      story: tx('A hidden fault is lurking in the spacecraft.', '機体に隠れた不具合がある。'),
      probability: rule(0.4),
      protectedIf: { kind: 'setting', key: 'testDepth', atLeast: 2 },
      partialIf: { kind: 'hasTag', tag: 'engineeringModel' },
      partial: [{ kind: 'failChance', subsystem: 'cdh', add: 0.05 }],
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.2 }],
      lesson: tx('Light testing let a fault through for {agency}.', '{agency}は、試験が薄く不具合を持ち込んだ。'),
      realCase: {
        who: tx('InSight (Mars)', 'InSight（火星）'), year: '2015–2018',
        text: tx('InSight: a leak in the seismometer’s vacuum container could not be fixed in pre-launch testing, so the 2016 launch was called off. It waited two years for the next window, at an extra US$153.8 million.', 'InSight：打ち上げ前の試験で地震計の真空容器の漏れが直らず、2016年の打ち上げを断念。次の窓まで2年待ち、1億5380万ドルが追加でかかった。'),
        sources: ['jpl-insight-2018'],
      },
    },
    {
      id: 'jlaunch-failure', phase: 4, name: tx('Launch failure', '打ち上げ失敗'),
      story: tx('The rocket fails.', 'ロケットが失敗した。'),
      probability: rule(0, tx('Drawn from the chosen rocket’s reliability instead of a fixed chance.', '一定の確率ではなく、選んだロケットの信頼性から引く。')),
      unprotected: [{ kind: 'missionLost', outcome: 'launchFailure' }],
      lesson: tx('{agency} lost the spacecraft at launch.', '{agency}は、打ち上げで探査機を失った。'),
    },
    {
      id: 'jcruise', phase: 5, name: tx('Engine trouble after arrival', '到着後のエンジンの不調'),
      story: tx('Before a planned engine burn at Jupiter, valves behave oddly. Skipping the burn keeps the spacecraft safe, but in a longer orbit with fewer close passes.', '木星での噴射の前に、弁の動きがおかしい。噴射を見送れば安全だが、周回が長くなり接近の回数が減る。'),
      probability: rule(0.3),
      partialIf: { kind: 'hasTag', tag: 'opsRehearsed' },
      partial: [{ kind: 'scienceFactor', factor: 0.9 }],
      unprotected: [{ kind: 'scienceFactor', factor: 0.75 }],
      lesson: tx('{agency} had not rehearsed a change of plan, and lost more close passes.', '{agency}は計画の変更を練習しておらず、接近の回数を多く失った。'),
      realCase: {
        who: tx('Juno', 'Juno'),
        year: '2016',
        text: tx('Juno (2016): two helium check valves took minutes instead of seconds to open, so the team skipped the burn to a shorter orbit and stayed in the 53-day orbit.', 'Juno（2016年）：ヘリウムの逆止弁2つが開くのに数秒でなく数分かかり、短い周回に移る噴射を見送って53日周回のまま観測した。'),
        sources: ['nasa-juno-orbit'],
      },
    },
    {
      id: 'jlong-cruise', phase: 5, name: tx('Wear from a long cruise', '長い航行での消耗'),
      story: tx('After years of swing-bys on the way, parts have worn and the team must nurse the spacecraft through the tour.', '途中のスイングバイで何年も飛ぶうちに部品が消耗し、チームは探査機をいたわりながら観測を続ける。'),
      probability: rule(0.25),
      protectedIf: { kind: 'hasTag', tag: 'direct' },
      partialIf: { kind: 'hasTag', tag: 'opsRehearsed' },
      partial: [{ kind: 'scienceFactor', factor: 0.95 }],
      unprotected: [{ kind: 'scienceFactor', factor: 0.85 }],
      lesson: tx('{agency} took the long route and its worn spacecraft observed less.', '{agency}は長い経路をとり、消耗した探査機で観測が減った。'),
    },
    {
      id: 'jinstrument-dose', phase: 5, name: tx('Instruments wear in the belts', '観測機器が放射線で劣化する'),
      story: tx('Instruments observing on every close pass spend the most time switched on deep in the radiation belts.', 'すべての接近で観測する機器は、放射線帯の奥で電源を入れている時間がいちばん長い。'),
      probability: rule(0.8, tx('Game value, after JunoCam (a camera outside the vault), which degraded after many orbits.', 'ゲームの値。容器の外にあるカメラ JunoCam が、多くの周回のあと劣化した例による。')),
      // Observing on fewer passes, or staying out of the belts, spares the instruments.
      protectedIf: { kind: 'any', of: [{ kind: 'settingAtMost', key: 'dutyCycle', atMost: 0.3 }, { kind: 'hasTag', tag: 'radiation:low' }] },
      partialIf: { kind: 'any', of: [{ kind: 'settingAtMost', key: 'dutyCycle', atMost: 0.6 }, { kind: 'hasTag', tag: 'vault-thick' }] },
      partial: [{ kind: 'failChance', subsystem: 'payload', add: 0.2 }],
      unprotected: [{ kind: 'failChance', subsystem: 'payload', add: 0.6 }],
      lesson: tx('{agency} observed on every pass without extra shielding, and its instruments wore out before the end of the tour.', '{agency}は追加の遮へいなしにすべての接近で観測し、観測期間の途中で機器が劣化した。'),
      realCase: {
        who: tx('Juno (JunoCam)', 'Juno（JunoCam）'),
        text: tx('JunoCam sits outside Juno’s titanium vault. It worked through 46 orbits, then radiation damage spoiled most images until engineers partly repaired it by heating (annealing).', 'JunoCamはJunoのチタンの容器の外にある。46周までは正常だったが、その後放射線の損傷で画像の多くが壊れ、加熱（アニール）でいったん一部を直した。'),
        sources: ['nasa-junocam'],
      },
    },
    {
      id: 'jradiation', phase: 5, name: tx('Radiation damage', '放射線による損傷'),
      story: tx('Jupiter’s radiation belts slowly damage the electronics.', '木星の放射線帯が、少しずつ電子機器を傷めた。'),
      probability: rule(0.7, tx('Game value. The same vault as the real spacecraft is safe on a tour of repeated flybys; orbiting Europa needs a thicker one.', 'ゲームの値。実機と同じ容器は、接近をくり返す方法なら無害。エウロパを周回するなら厚い容器が要る。')),
      // Clipper's vault was sized for a flyby tour that leaves the belts between passes; living in them needs more.
      protectedIf: { kind: 'any', of: [{ kind: 'hasTag', tag: 'vault-thick' }, { kind: 'hasTag', tag: 'radiation:low' }, { kind: 'all', of: [{ kind: 'hasTag', tag: 'vault' }, { kind: 'hasTag', tag: 'tour' }] }] },
      partialIf: { kind: 'hasTag', tag: 'vault' },
      partial: [{ kind: 'failChance', subsystem: 'cdh', add: 0.1 }],
      unprotected: [{ kind: 'failChance', subsystem: 'cdh', add: 0.5 }],
      lesson: tx('The same radiation hit everyone; {agency}’s vault was too thin.', '同じ放射線が全機関を襲った。{agency}の保護容器は薄すぎた。'),
    },
    {
      id: 'jeuropa-orbit', phase: 5, name: tx('Constant radiation in Europa orbit', 'エウロパ周回での絶え間ない放射線'),
      story: tx('Staying close to Europa means never leaving the worst radiation.', 'エウロパのそばに居続けるので、最も強い放射線から抜け出せない。'),
      probability: rule(0.8),
      protectedIf: { kind: 'hasTag', tag: 'tour' },
      partialIf: { kind: 'hasTag', tag: 'vault-thick' },
      partial: [{ kind: 'durationFactor', factor: 0.3 }],
      unprotected: [{ kind: 'durationFactor', factor: 0.15 }],
      lesson: tx('{agency} orbited Europa and the electronics did not last.', '{agency}はエウロパを周回し、電子機器が持たなかった。'),
    },
    {
      id: 'jdsn', phase: 5, name: tx('Antenna time cut', 'アンテナ時間の削減'),
      story: tx('Other missions need the big antennas; your time is cut.', 'ほかのミッションが大型アンテナを必要とし、時間が削られた。'),
      probability: rule(0.35),
      protectedIf: { kind: 'margin', resource: 'downlink', atLeast: 0.7 },
      unprotected: [{ kind: 'scienceFactor', factor: 0.85 }],
      lesson: tx('{agency} could not send everything when antenna time was cut.', '{agency}は、アンテナの時間が減ったときにデータを送りきれなかった。'),
      realCase: {
        who: tx('NASA Deep Space Network', 'NASAの深宇宙通信網'),
        year: '2023',
        text: tx('NASA’s Inspector General found that demand on the Deep Space Network sometimes exceeds what it can provide by about 40%.', 'NASAの監察官室によると、深宇宙通信網への需要は、ときに供給を約40%上回る。'),
        sources: ['nasa-oig-dsn'],
      },
    },
    {
      id: 'jantenna', phase: 5, name: tx('Antenna fails to open', 'アンテナが開かない'),
      story: tx('The high-gain antenna does not unfold fully. Data must trickle home through a small antenna.', '高利得アンテナが開ききらなかった。小さなアンテナで少しずつデータを送るしかない。'),
      probability: rule(0.12),
      partialIf: { kind: 'margin', resource: 'downlink', atLeast: 0.4 },
      partial: [{ kind: 'scienceFactor', factor: 0.75 }],
      unprotected: [{ kind: 'scienceFactor', factor: 0.45 }],
      lesson: tx('{agency} had no spare downlink when the main antenna failed to open.', '{agency}には、主アンテナが開かなかったときの通信の余裕がなかった。'),
      realCase: {
        who: tx('Galileo', 'Galileo'),
        year: '1991',
        text: tx('Galileo: on 11 April 1991 its high-gain antenna failed to open fully, and it never did. A link planned at 134.4 kbit/s fell to 10 bit/s; compression and better ground antennas brought it back to about 1–2 kbit/s.', 'Galileo：1991年4月11日、高利得アンテナが開ききらず、その後も開かなかった。毎秒134.4キロビットの計画が毎秒10ビットになり、データ圧縮と地上アンテナの工夫で実効1〜2キロビットまで戻した。'),
        sources: ['jpl-galileo-hga-1991', 'nasa-tda-galileo', 'nasa-scan-galileo'],
      },
    },
    {
      id: 'jcamera-heal', phase: 5, name: tx('Camera damaged by radiation', '放射線でカメラが傷む'),
      story: tx('Radiation damages a camera and its images start to break up. Heating it for a while might repair it, if the team knows how to try it safely.', '放射線でカメラが傷み、画像が乱れ始めた。しばらく温めれば直るかもしれない。チームが安全な試し方を知っていれば。'),
      probability: rule(0.3),
      protectedIf: { kind: 'hasTag', tag: 'opsRehearsed' },
      unprotected: [{ kind: 'scienceFactor', factor: 0.9 }],
      lesson: tx('{agency}’s team had not practised recoveries and lost images to a damaged camera.', '{agency}のチームは復旧の練習をしておらず、傷んだカメラで画像を失った。'),
      realCase: {
        who: tx('Juno (JunoCam)', 'Juno（JunoCam）'),
        year: '2023',
        text: tx('JunoCam (2023): the team heated the camera to 77°F (25°C) to anneal it, and it recovered in time for Juno’s close pass of Io on 30 December 2023.', 'JunoCam（2023年）：カメラを77°F（25℃）まで温める焼きなましで回復させ、2023年12月30日のイオへの接近に間に合わせた。'),
        sources: ['nasa-junocam'],
      },
    },
    {
      id: 'jplume', phase: 5, name: tx('Active plume', '活発な噴出'),
      story: tx('A plume erupts during a flyby: a rare chance to sample the ocean.', '接近中に噴出が起きた。海を直接調べられる貴重な好機。'),
      probability: rule(0.25),
      unprotected: [],
      readyIf: { kind: 'hasTag', tag: 'insitu' },
      benefit: [{ kind: 'scienceFactor', factor: 1.3 }],
      lesson: tx('{agency} carried an in-situ instrument and sampled the plume.', '{agency}は、その場で測る機器を積んでいて噴出物を調べられた。'),
    },
    {
      id: 'jfunding-gap', phase: 1, name: tx('Funding lapse', '予算の成立が遅れる'),
      story: tx('Appropriations lapse and government work stops. Contracts and reviews wait.', '予算の成立が遅れ、政府機関の仕事が止まった。契約と審査が進まない。'),
      probability: est(0.23, ['crs-funding-gaps'], tx('Of the 13 fiscal years 2014–2026, three had a government-wide funding lapse of 16 days or more (16 days in FY2014, 34 in FY2019, 42 in FY2026).', '2014〜2026年度の13年度のうち、政府全体の予算の空白が16日以上続いたのは3回（2014年度16日、2019年度34日、2026年度42日）。')),
      protectedIf: { kind: 'margin', resource: 'schedule', atLeast: 0.1 },
      unprotected: [{ kind: 'delayDays', days: 45 }],
      lesson: tx('{agency} had no schedule margin when funding lapsed.', '{agency}は、予算の空白のときに日程の余裕がなかった。'),
      realCase: {
        who: tx('NASA projects', 'NASAの計画'),
        year: '2025',
        text: tx('GAO: during the funding lapse, the start of the solar electric propulsion life test slipped, and NISAR postponed its review before operations.', 'GAO：予算の空白で、太陽電気推進（SEP）の寿命試験の開始が遅れ、NISARは運用開始前の審査を延ばした。'),
        sources: ['gao-26-108556'],
      },
    },
    {
      id: 'jintegration-slip', phase: 4, name: tx('Assembly and test run long', '組立と試験が長引く'),
      story: tx('Problems that only show up once everything is assembled stretch the test campaign.', '組み立てて初めて分かる不具合が続き、試験の日程が延びた。'),
      probability: est(0.5, ['nasa-lcc-growth'], tx('Across 20 NASA science missions launched 2000–2009, launch dates slipped on average more than 13 months from the plan at PDR, mostly during assembly and test. Slipping is the norm, so the game uses 0.5 (the value itself is a game choice).', 'NASAの科学ミッション20機（2000〜2009年打ち上げ）で、打ち上げ日はPDR時点の計画から平均13か月以上遅れ、その大半は組立・試験の間に起きた。遅れるのが普通なので0.5とした（値そのものはゲームの判断）。')),
      protectedIf: { kind: 'margin', resource: 'schedule', atLeast: 0.15 },
      partialIf: { kind: 'hasTag', tag: 'engineeringModel' },
      partial: [{ kind: 'delayDays', days: 45 }],
      unprotected: [{ kind: 'delayDays', days: 90 }],
      lesson: tx('{agency} had no schedule margin when assembly and test ran long.', '{agency}は、組立と試験が延びたときに日程の余裕がなかった。'),
    },
    {
      id: 'launcher-undecided', phase: 1, name: tx('No rocket yet', 'ロケットが決まらない'),
      story: tx('Which rocket you fly on is stuck in politics. You keep the design compatible with all of them and budget for the wait.', 'どのロケットで打ち上げるかが政治の場で決まらない。どれにも載る設計を保ち、待つ費用を積む。'),
      probability: rule(0.3, tx('Game value. That a mass margin makes the wait harmless is the game’s rule; the US$250 million is the real reserve.', 'ゲームの値。質量の余裕があれば無害、というのはゲームの決めごと。2億5000万ドルは実例の予備費。')),
      protectedIf: { kind: 'margin', resource: 'mass', atLeast: 0.2 },
      partialIf: { kind: 'margin', resource: 'mass', atLeast: 0.1 },
      partial: [{ kind: 'resource', resource: 'budget', delta: -100000 }],
      unprotected: [{ kind: 'resource', resource: 'budget', delta: -250000 }],
      lesson: tx('{agency} had little mass margin, and waiting for a rocket decision cost it dearly.', '{agency}は質量に余裕がなく、ロケットが決まるまでの費用がかさんだ。'),
      realCase: {
        who: tx('Europa Clipper', 'エウロパ・クリッパー'),
        year: '2019',
        text: tx('Congress required an SLS launch, so NASA kept the spacecraft able to fly on SLS or two commercial rockets. Storing it while waiting for SLS would cost US$3–5 million a month, and US$250 million was set aside.', '議会がSLSでの打ち上げを指定し、NASAはSLSと商用ロケット2種の両方に載せられる設計を維持した。SLSを待つ保管に月300〜500万ドルがかかる見込みで、2億5000万ドルの予備費が積まれた。'),
        sources: ['nasa-oig-europa-letter', 'nasa-oig-europa'],
      },
    },
    {
      id: 'instrument-growth', phase: 2, name: tx('Instrument costs grow', '観測機器の費用が膨らむ'),
      story: tx('One instrument runs far over its estimate while still in design.', '観測機器の1つが、設計の途中で見積もりを大きく超えた。'),
      probability: est(0.5, ['nasa-lcc-growth'], tx('Across 20 NASA science missions, instrument costs grew on average 103% from the start of design to launch. Growth is the norm, so the game uses 0.5 (the value itself is a game choice).', 'NASAの科学ミッション20機で、観測機器の費用は設計の開始から打ち上げまでに平均103%増えた。増えるのが普通なので0.5とした（値そのものはゲームの判断）。')),
      protectedIf: { kind: 'margin', resource: 'budget', atLeast: 0.35 },
      partialIf: { kind: 'margin', resource: 'budget', atLeast: 0.2 },
      partial: [{ kind: 'resource', resource: 'budget', delta: -100000 }],
      unprotected: [{ kind: 'resource', resource: 'budget', delta: -200000 }, { kind: 'scienceFactor', factor: 0.9 }],
      lesson: tx('{agency} had no budget margin and swapped an instrument for a simpler one.', '{agency}は予算に余裕がなく、機器を簡素なものに替えた。'),
      realCase: {
        who: tx('Europa Clipper', 'エウロパ・クリッパー'),
        year: '2019',
        text: tx('Citing cost growth, NASA dropped the ICEMAG magnetometer and turned to a simpler one.', '費用の増加を理由に、NASAは磁力計ICEMAGを外し、より簡素な磁力計に替えた。'),
        sources: ['nasa-icemag'],
      },
    },
    {
      id: 'hurricane', phase: 3, name: tx('Hurricane at the launch site', '射場にハリケーン'),
      story: tx('A hurricane heads for the launch site days before liftoff. The spacecraft goes back into the hangar.', '打ち上げの直前、ハリケーンが射場に近づいた。探査機を格納庫に戻して待つ。'),
      probability: rule(0.2),
      protectedIf: { kind: 'margin', resource: 'schedule', atLeast: 0.05 },
      unprotected: [{ kind: 'delayDays', days: 30 }],
      lesson: tx('{agency} had no slack at all, and a few days’ stand-down cost it the launch period.', '{agency}は日程にまったく余裕がなく、数日の見送りで打ち上げ期間を逃した。'),
      realCase: {
        who: tx('Europa Clipper', 'エウロパ・クリッパー'),
        year: '2024',
        text: tx('Hurricane Milton scrubbed the 10 October launch, but the launch period ran to 6 November and it flew on 14 October.', 'ハリケーン・ミルトンで10月10日の打ち上げを見送ったが、打ち上げ期間は11月6日まであり、10月14日に打ち上げた。'),
        sources: ['nasa-clipper-milton'],
      },
    },
  ],
};
