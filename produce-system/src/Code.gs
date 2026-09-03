/**
 * Midori No Mart 青果 在庫・販売分析システム
 * ===========================================================
 * メインスクリプト：セットアップ・メニュー・自動計算
 *
 * 使い方：
 *   初回のみ「setup()」を実行 → 全シート・初期データ・為替・トリガーを自動生成
 *   以後はスプレッドシート上部メニュー「青果システム」から操作
 * ===========================================================
 */

// ----- シート名（変更しないでください） -----
const SHEET_MASTER    = '商品マスター';
const SHEET_RECEIVING = '入荷管理';
const SHEET_DAILY     = '日次在庫';
const SHEET_ANALYSIS  = '分析';
const SHEET_ORDER     = '発注判断';
const SHEET_DASHBOARD = 'ダッシュボード';
const SHEET_SETTINGS  = '設定';
const SHEET_ADJUST    = '在庫調整';
const SHEET_PROCESS   = '加工記録';
const SHEET_GIFT_LOG  = 'ギフト販売';

/**
 * 果物ギフトボックス定義（まとめ売りセット）
 *   name=内部キー, label=英語名, price=販売PHP, cost=原価JPY(構成果物の合計),
 *   en=中身の英語説明, accent=カード色（A/C取り違え防止でりんごの色分け）
 */
const GIFT_SEED = [
  { name:'果物ギフト①', label:'Gift A', price:4990, cost:7682,
    en:'Shizuoka Melon ×1 + 🟢GREEN Apple (Shinano Gold) ×1 + Loquat ×3', accent:'#34a853' },
  { name:'果物ギフト②', label:'Gift B', price:3790, cost:6760,
    en:'Shizuoka Melon ×1 + Blueberry (Japan) ×1 pack', accent:'#1a73e8' },
  { name:'果物ギフト③', label:'Gift C', price:4990, cost:7630,
    en:'Shizuoka Melon ×1 + 🔴RED Apple (Fuji) ×1 + Loquat ×3', accent:'#d93025' },
  { name:'果物ギフト④', label:'Gift D', price:2790, cost:2582,
    en:'Apple (Fuji) ×1 + Apple (Shinano Gold) ×1 + Dekopon ×1 + Loquat ×3', accent:'#e8710a' },
];

/** ギフトの構成（材料）：[材料商品名, 数量] ※商品名は商品マスターと一致必須 */
const GIFT_RECIPE = {
  '果物ギフト①': [['静岡青肉メロン',1],['りんご（シナノゴールド）',1],['びわ',3]],
  '果物ギフト②': [['静岡青肉メロン',1],['国産ブルーベリー',1]],
  '果物ギフト③': [['静岡青肉メロン',1],['りんご（フジ）',1],['びわ',3]],
  '果物ギフト④': [['りんご（フジ）',1],['りんご（シナノゴールド）',1],['デコポン',1],['びわ',3]],
};

/** ギフト名の一覧（内部キー） */
function giftNames_() { return GIFT_SEED.map(function (x) { return x.name; }); }

// ----- 設定セル位置 -----
const CELL_RATE_MODE   = 'B2'; // 為替モード（自動 / 手動）
const CELL_RATE_AUTO   = 'B3'; // 自動レート（GOOGLEFINANCE）
const CELL_RATE_MANUAL = 'B4'; // 手動レート
const CELL_RATE_USED   = 'B5'; // 採用レート
const CELL_ALERT_RED   = 'B6'; // 在庫日数 赤 閾値
const CELL_ALERT_YELLOW= 'B7'; // 在庫日数 黄 閾値

/**
 * 初期商品データ
 * [商品名, 英語名, 単位, 初期入荷数, 仕入原価JPY, 加工費JPY, 販売価格PHP, アラート基準在庫数]
 *   ※ 日本語の「商品名」が内部キー。スタッフ画面には「英語名」が表示される。
 */
const SEED_PRODUCTS = [
  ['きゅうり',              'Cucumber',            '本',     29,  134,   0, 129,   4],
  ['じゃがいも',            'Potato',              '個',     23,   96,   0,  89,   3],
  ['キャベツ',              'Cabbage',             '個',      5,  400,   0, 349,   2],
  ['チンゲン菜',            'Bok Choy',            '束',     10,  190,   0, 169,   2],
  ['トマト',                'Tomato',              '個',     22,  300,   0, 279,   3],
  ['なす',                  'Eggplant',            '個',     10,  520,   0, 449,   2],
  ['ピーマン',              'Green Pepper',        '個',      9,  556,   0, 479,   2],
  ['赤キャベツ',            'Red Cabbage',         '個',      2,  500,   0, 429,   2],
  ['長ねぎ',                'Leek (Negi)',         '本',     45,  116,   0, 169,   7],
  ['レタス',                'Lettuce',             '個',      9,  311,   0, 269,   2],
  ['紅はるか（生）',         'Sweet Potato (Raw)',  '本',    135,  385,   0, 349,  20],
  ['紅はるか（焼き芋）',     'Sweet Potato (Baked)','本',    135,  385,   0, 349,  20], // 加工費は確定後に商品マスターで修正
  ['りんご（フジ）',         'Apple (Fuji)',        '個',     40,  340,   0, 449,   6],
  ['りんご（シナノゴールド）','Apple (Shinano Gold)','個',     32,  392,   0, 479,   5],
  ['生しいたけ',            'Fresh Shiitake',      'パック',  4, 1045,   0, 899,   2],
  ['びわ',                  'Loquat',              '個',     12,  450,   0, 499,   2],
  ['さくらんぼ',            'Cherry',              'パック',  8, 1250,   0,1090,   2],
  ['国産ブルーベリー',       'Blueberry (Japan)',   'パック',  8,  820,   0, 499,   2],
  ['静岡青肉メロン',         'Shizuoka Melon',      '個',      4, 5940,   0,3490,   2],
  ['デコポン',              'Dekopon',             '個',     12,  500,   0, 649,   2],
];

/** 単位の英語表示マップ（スタッフ画面用） */
const UNIT_EN = { '本': 'pc', '個': 'pc', '束': 'bunch', 'パック': 'pack' };

/** スプレッドシートを開いたときにメニューを追加 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🥬 青果システム')
    .addItem('▶ 全データ再計算', 'recalcAll')
    .addSeparator()
    .addItem('① 初回セットアップ（最初の1回だけ）', 'setup')
    .addItem('② スタッフ用Webアプリの開き方を表示', 'showWebAppHelp')
    .addItem('③ システム更新（在庫調整シート追加）', 'applyUpdate')
    .addItem('④ 果物ギフトを追加（1回だけ）', 'addGiftBoxes')
    .addToUi();
}

/**
 * 初回セットアップ：全シート作成・初期データ投入・為替設定・トリガー登録
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  buildSettings_(ss);
  buildMaster_(ss);
  buildReceiving_(ss);
  buildDaily_(ss);
  buildAdjust_(ss);
  buildProcess_(ss);
  buildAnalysis_(ss);
  buildOrder_(ss);
  buildDashboard_(ss);

  // デフォルトの「シート1」が残っていたら削除
  const def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  installTriggers_();
  recalcAll();

  SpreadsheetApp.getUi().alert(
    'セットアップ完了',
    '全シートと初期データを作成しました。\n\n' +
    '次の手順：\n' +
    '1. 「設定」シートで手動レートを確認\n' +
    '2. メニュー「青果システム → ②」でスタッフ用アプリを公開\n' +
    '3. 毎日スタッフが「日次在庫」を入力',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

// ============================================================
// 各シート作成
// ============================================================

function getOrCreateSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  else sh.clear();
  return sh;
}

function buildSettings_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_SETTINGS);
  sh.getRange('A1').setValue('⚙ 設定').setFontWeight('bold').setFontSize(14);
  const rows = [
    ['為替モード（自動 / 手動）', '自動'],
    ['自動レート PHP→JPY（Google）', '=IFERROR(GOOGLEFINANCE("CURRENCY:PHPJPY"),"")'],
    ['手動レート PHP→JPY', 2.6],
    ['採用レート PHP→JPY', '=IF($B$2="手動",$B$4,$B$3)'],
    ['在庫日数 赤アラート（日以内）', 3],
    ['在庫日数 黄アラート（日以内）', 7],
  ];
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.getRange('A2:A7').setFontWeight('bold');
  sh.getRange('B2').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['自動', '手動'], true).build()
  );
  sh.getRange('B3:B5').setNumberFormat('0.0000');
  sh.getRange('A9').setValue(
    '※ 採用レートは PHP 1 あたりの日本円。例) 2.6 = 1ペソ2.6円\n' +
    '※ Google為替が取れない時間帯は「手動」に切り替えてください'
  ).setFontColor('#666666');
  sh.setColumnWidth(1, 240);
  sh.setColumnWidth(2, 140);
}

function buildMaster_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_MASTER);
  const headers = ['商品ID','商品名','英語名','単位','初期入荷数','仕入原価JPY','加工費JPY',
                   '実質原価JPY','販売価格PHP','売価JPY換算','粗利JPY','粗利率','アラート基準在庫数'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');

  const data = SEED_PRODUCTS.map((p, i) => {
    const id = 'P' + String(i + 1).padStart(2, '0');
    // [ID,名,英名,単位,初期数,原価,加工費, 実質原価(式), 販売PHP, 売価JPY(式), 粗利(式), 粗利率(式), アラート基準]
    return [id, p[0], p[1], p[2], p[3], p[4], p[5], '', p[6], '', '', '', p[7]];
  });
  sh.getRange(2, 1, data.length, headers.length).setValues(data);

  // 計算式（行ごと）  H=実質原価, J=売価JPY換算, K=粗利, L=粗利率
  for (let r = 2; r <= data.length + 1; r++) {
    sh.getRange(r, 8).setFormula(`=F${r}+G${r}`);                       // 実質原価 = 仕入原価+加工費
    sh.getRange(r,10).setFormula(`=I${r}*${SHEET_SETTINGS}!$B$5`);      // 売価JPY換算 = 販売PHP×採用レート
    sh.getRange(r,11).setFormula(`=J${r}-H${r}`);                       // 粗利JPY = 売価JPY-実質原価
    sh.getRange(r,12).setFormula(`=IF(J${r}=0,0,K${r}/J${r})`);         // 粗利率
  }
  sh.getRange(2, 12, data.length, 1).setNumberFormat('0.0%');
  sh.getRange(2, 6, data.length, 6).setNumberFormat('#,##0');

  // 加工先商品（焼き芋など）：この商品をアプリで「Baked」入力すると、加工先の在庫が増える
  sh.getRange(1, 14).setValue('加工先商品')
    .setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  for (let r = 2; r <= data.length + 1; r++) {
    if (sh.getRange(r, 2).getValue() === '紅はるか（生）') {
      sh.getRange(r, 14).setValue('紅はるか（焼き芋）');
    }
  }
  // 加工先商品の選択肢（商品名から選べるように）
  sh.getRange(2, 14, data.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(sh.getRange('B2:B'), true).build()
  );

  // 販売中（いいえ＝アプリ非表示・発注/ダッシュボード対象外）
  sh.getRange(1, 15).setValue('販売中')
    .setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  sh.getRange(2, 15, data.length, 1).setValue('はい');
  sh.getRange(2, 15, data.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['はい', 'いいえ'], true).build()
  );

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 15);
}

function buildReceiving_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_RECEIVING);
  const headers = ['入荷ID','入荷日','商品名','入荷数','仕入原価JPY','備考'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');

  // 初回入荷を「初期入荷数」で自動登録（本日日付）
  const today = new Date();
  const rows = SEED_PRODUCTS.map((p, i) => {
    return ['R' + String(i + 1).padStart(3, '0'), today, p[0], p[3], p[4], '初回入荷'];
  });
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sh.getRange(2, 2, rows.length, 1).setNumberFormat('yyyy/mm/dd');

  // 商品名は商品マスターから選択
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(SHEET_MASTER).getRange('B2:B'), true).build();
  sh.getRange(2, 3, 500, 1).setDataValidation(rule);
  sh.getRange(2, 2, 500, 1).setNumberFormat('yyyy/mm/dd');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function buildDaily_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_DAILY);
  const headers = ['日付','商品名','現在在庫数','入力者','記録時刻'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#f9ab00').setFontColor('#ffffff');
  sh.getRange(2, 1, 1000, 1).setNumberFormat('yyyy/mm/dd');
  sh.getRange(2, 5, 1000, 1).setNumberFormat('yyyy/mm/dd hh:mm');

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(SHEET_MASTER).getRange('B2:B'), true).build();
  sh.getRange(2, 2, 1000, 1).setDataValidation(rule);
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 160);
}

function buildAdjust_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_ADJUST);
  const headers = ['日付','商品名','区分','数量','理由・備考'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#9334e6').setFontColor('#ffffff');
  sh.getRange(2, 1, 1000, 1).setNumberFormat('yyyy/mm/dd');
  // 区分プルダウン
  sh.getRange(2, 3, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['廃棄', '試食', '加工', '社外持出', 'その他'], true).build()
  );
  // 商品名プルダウン
  sh.getRange(2, 2, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInRange(ss.getSheetByName(SHEET_MASTER).getRange('B2:B'), true).build()
  );
  sh.getRange('G1').setValue(
    '※「在庫数」とは別に、売れずに減った分（腐り廃棄・社外持出など）を記録します。\n' +
    '※ ここに記録した数は「販売数」から除かれ、正確な販売率・粗利が出ます。'
  ).setFontColor('#666666');
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(5, 240);
}

function buildProcess_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_PROCESS);
  const headers = ['日付','元商品','加工後商品','数量','備考'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#e8710a').setFontColor('#ffffff');
  sh.getRange(2, 1, 1000, 1).setNumberFormat('yyyy/mm/dd');
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getSheetByName(SHEET_MASTER).getRange('B2:B'), true).build();
  sh.getRange(2, 2, 1000, 1).setDataValidation(rule); // 元商品
  sh.getRange(2, 3, 1000, 1).setDataValidation(rule); // 加工後商品
  sh.getRange('G1').setValue(
    '※ 在庫を加工して別商品にした記録（焼き芋など）。1行入れるだけでOK。\n' +
    '※ 元商品の在庫が減り、加工後商品の在庫が増えます（販売・原価には影響しません）。\n' +
    '例) 元商品=紅はるか（生）、加工後商品=紅はるか（焼き）、数量=10'
  ).setFontColor('#666666');
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(5, 220);
}

const ANALYSIS_HEADERS = ['商品名','単位','累計入荷数','現在在庫','累計販売数','当日販売数',
                   '廃棄・調整数','販売率','残在庫率','入荷からの日数','1日平均販売数','在庫日数',
                   '完売予測日','在庫金額JPY','想定売上JPY','想定粗利JPY','発注ステータス'];

function buildAnalysis_(ss) {
  getOrCreateSheet_(ss, SHEET_ANALYSIS);
  rebuildAnalysisHeaders_(ss);
}

function rebuildAnalysisHeaders_(ss) {
  const sh = ss.getSheetByName(SHEET_ANALYSIS) || ss.insertSheet(SHEET_ANALYSIS);
  sh.getRange(1, 1, 1, ANALYSIS_HEADERS.length).setValues([ANALYSIS_HEADERS])
    .setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

/**
 * 既存システムに「在庫調整」機能を追加する（初回セットアップ済みの人向け・データは消えません）
 */
function applyUpdate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_ADJUST)) {
    buildAdjust_(ss);
  } else {
    // 既存の在庫調整シートでも区分プルダウンを最新化（試食などを追加）
    ss.getSheetByName(SHEET_ADJUST).getRange(2, 3, 1000, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['廃棄', '試食', '加工', '社外持出', 'その他'], true).build()
    );
  }
  if (!ss.getSheetByName(SHEET_PROCESS)) buildProcess_(ss);

  // 商品マスターに「加工先商品」列を追加（既存シート向け）
  const m = ss.getSheetByName(SHEET_MASTER);
  if (m.getRange(1, 14).getValue() !== '加工先商品') {
    m.getRange(1, 14).setValue('加工先商品')
      .setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  }
  const mv = m.getDataRange().getValues();
  for (let i = 1; i < mv.length; i++) {
    if (mv[i][1] === '紅はるか（生）' && !mv[i][13]) {
      m.getRange(i + 1, 14).setValue('紅はるか（焼き芋）');
    }
  }
  if (mv.length > 1) {
    m.getRange(2, 14, mv.length - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInRange(m.getRange('B2:B'), true).build()
    );
  }

  // 「販売中」列を追加（既存シート向け）
  if (m.getRange(1, 15).getValue() !== '販売中') {
    m.getRange(1, 15).setValue('販売中')
      .setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff');
  }
  if (mv.length > 1) {
    for (let i = 1; i < mv.length; i++) {
      if (!mv[i][14]) m.getRange(i + 1, 15).setValue('はい'); // 空なら「はい」
    }
    m.getRange(2, 15, mv.length - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['はい', 'いいえ'], true).build()
    );
  }

  rebuildAnalysisHeaders_(ss);
  installTriggers_();
  recalcAll();
  SpreadsheetApp.getUi().alert(
    '更新完了',
    '「在庫調整」シートを追加しました。\n\n' +
    '廃棄や社外持出（腐り・社長持出など）をこのシートに記録すると、' +
    '販売数から除かれて正確な分析になります。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 【1回だけ実行】さつまいもをサイズ別（小・大）4商品に移行する。
 * - 紅はるか（生・小/大）、（焼き芋・小/大）を商品マスターに追加
 * - 本日の在庫を初回入荷として登録（生小50・生大41・焼き芋大2）
 * - 古い「紅はるか（生）/（焼き芋）」をアプリ非表示にし、残りを新商品へ移行して締める
 */
function migrateSweetPotatoSizes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const master = ss.getSheetByName(SHEET_MASTER);
  const recv   = ss.getSheetByName(SHEET_RECEIVING);
  const adj    = ss.getSheetByName(SHEET_ADJUST);
  const daily  = ss.getSheetByName(SHEET_DAILY);
  const today  = new Date();

  // 二重実行防止
  const existingNames = master.getRange('B2:B' + master.getLastRow()).getValues().flat();
  if (existingNames.indexOf('紅はるか（生・小）') > -1) {
    ui.alert('この移行はすでに実行済みです。');
    return;
  }

  // 必要な列・シートが無ければ用意（applyUpdate相当の保険）
  if (master.getRange(1, 14).getValue() !== '加工先商品') master.getRange(1, 14).setValue('加工先商品');
  if (master.getRange(1, 15).getValue() !== '販売中') master.getRange(1, 15).setValue('販売中');
  if (!ss.getSheetByName(SHEET_ADJUST)) buildAdjust_(ss);
  if (!ss.getSheetByName(SHEET_PROCESS)) buildProcess_(ss);

  // 新4商品 [ID,名,英名,単位,初期数,原価,加工費,販売PHP,アラート,加工先]
  const newProducts = [
    ['P21', '紅はるか（生・小）',     'Sweet Potato (Raw, S)',   '本', 50, 385, 0, 299, 10, '紅はるか（焼き芋・小）'],
    ['P22', '紅はるか（生・大）',     'Sweet Potato (Raw, L)',   '本', 41, 385, 0, 349, 10, '紅はるか（焼き芋・大）'],
    ['P23', '紅はるか（焼き芋・小）', 'Sweet Potato (Baked, S)', '本',  0, 385, 0, 299,  2, ''],
    ['P24', '紅はるか（焼き芋・大）', 'Sweet Potato (Baked, L)', '本',  2, 385, 0, 349,  2, ''],
  ];
  let r = master.getLastRow() + 1;
  newProducts.forEach(p => {
    master.getRange(r, 1, 1, 7).setValues([[p[0], p[1], p[2], p[3], p[4], p[5], p[6]]]);
    master.getRange(r, 8).setFormula(`=F${r}+G${r}`);                    // 実質原価
    master.getRange(r, 9).setValue(p[7]);                                // 販売PHP
    master.getRange(r, 10).setFormula(`=I${r}*${SHEET_SETTINGS}!$B$5`);  // 売価JPY
    master.getRange(r, 11).setFormula(`=J${r}-H${r}`);                   // 粗利
    master.getRange(r, 12).setFormula(`=IF(J${r}=0,0,K${r}/J${r})`);     // 粗利率
    master.getRange(r, 12).setNumberFormat('0.0%');
    master.getRange(r, 13).setValue(p[8]);                               // アラート基準
    master.getRange(r, 14).setValue(p[9]);                               // 加工先商品
    master.getRange(r, 15).setValue('はい');                             // 販売中
    r++;
  });

  // 本日の在庫を初回入荷として登録（生小50・生大41・焼き芋大2）
  const recvRows = [
    ['紅はるか（生・小）', 50],
    ['紅はるか（生・大）', 41],
    ['紅はるか（焼き芋・大）', 2],
  ];
  recvRows.forEach((x, i) => {
    recv.appendRow(['R' + String(101 + i), today, x[0], x[1], 385, 'サイズ別 初回入荷']);
  });

  // 古い2商品を「販売中=いいえ」に（アプリ非表示・発注対象外）
  const mNames = master.getRange(2, 2, master.getLastRow() - 1, 1).getValues().flat();
  ['紅はるか（生）', '紅はるか（焼き芋）'].forEach(nm => {
    const idx = mNames.indexOf(nm);
    if (idx > -1) master.getRange(idx + 2, 15).setValue('いいえ');
  });

  // 残り在庫を新商品へ移行（販売ではない＝その他）＋古い在庫を0で締める
  adj.appendRow([today, '紅はるか（生）',   'その他', 91, 'サイズ別へ移行']);
  adj.appendRow([today, '紅はるか（焼き芋）', 'その他',  2, 'サイズ別へ移行']);
  daily.appendRow([today, '紅はるか（生）',   0, 'システム移行', today]);
  daily.appendRow([today, '紅はるか（焼き芋）', 0, 'システム移行', today]);

  recalcAll();
  ui.alert(
    '移行完了',
    'さつまいもをサイズ別の4商品に移行しました。\n\n' +
    '・新商品：生（小/大）、焼き芋（小/大）\n' +
    '・古い2商品はアプリ非表示にしました（履歴は分析に残ります）\n' +
    '・仕分け前に売れた生1個は古い商品の販売として計上済みです',
    ui.ButtonSet.OK
  );
}

/**
 * 【1回だけ実行】スタッフが入力できていなかった廃棄分（2026年7月〜8月上旬）を
 * 在庫調整シートに 区分=廃棄 でまとめて記録する。二重実行防止つき。
 * 実行後 recalcAll() で販売率・粗利などを再計算する。
 */
function bulkAddWasteJul2026() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const adj = ss.getSheetByName(SHEET_ADJUST);
  if (!adj) { ui.alert('在庫調整シートがありません。先にメニュー「③システム更新」を実行してください。'); return; }

  const TAG = 'スタッフ未入力分の廃棄（7-8月まとめ）';

  // 二重実行防止（同じ備考タグがあれば中止）
  const lastRow = adj.getLastRow();
  if (lastRow >= 2) {
    const notes = adj.getRange(2, 5, lastRow - 1, 1).getValues().flat();
    if (notes.indexOf(TAG) > -1) { ui.alert('この廃棄分はすでに登録済みです。'); return; }
  }

  // [年, 月(1-12), 日, 商品名, 数量]
  const rows = [
    [2026, 7, 12, 'トマト', 6],
    [2026, 7, 12, 'きゅうり', 4],
    [2026, 7, 14, 'さくらんぼ', 1],
    [2026, 7, 21, 'トマト', 1],
    [2026, 7, 21, 'レタス', 1],
    [2026, 7, 24, 'トマト', 2],
    [2026, 7, 24, 'さくらんぼ', 1],
    [2026, 7, 24, '紅はるか（焼き芋・大）', 1],
    [2026, 7, 25, 'トマト', 1],
    [2026, 7, 25, 'レタス', 1],
    [2026, 7, 28, 'きゅうり', 2],
    [2026, 7, 31, '紅はるか（生・大）', 2],
    [2026, 7, 31, 'チンゲン菜', 3],
    [2026, 8,  2, 'トマト', 2],
    [2026, 8,  2, 'レタス', 2],
    [2026, 8,  2, 'さくらんぼ', 1],
    [2026, 8,  2, '紅はるか（焼き芋・小）', 1],
  ];

  // 商品名が商品マスターに存在するか検証（誤記入で集計から漏れるのを防ぐ）
  const master = ss.getSheetByName(SHEET_MASTER);
  const validNames = master.getRange(2, 2, master.getLastRow() - 1, 1).getValues().flat();
  const unknown = rows.map(r => r[3]).filter((n, i, a) => a.indexOf(n) === i && validNames.indexOf(n) < 0);
  if (unknown.length) { ui.alert('商品マスターに無い商品名があります（登録を中止）：\n' + unknown.join('\n')); return; }

  rows.forEach(r => {
    adj.appendRow([new Date(r[0], r[1] - 1, r[2]), r[3], '廃棄', r[4], TAG]);
  });

  recalcAll();
  ui.alert('登録完了', rows.length + '件の廃棄を在庫調整シートに記録しました。', ui.ButtonSet.OK);
}

/**
 * 【1回だけ実行】bulkAddWasteJul2026 で入れた廃棄のうち、スタッフのアプリ入力と
 * 「日付・商品・数量」が完全一致する重複（まとめ入力分）を削除する。
 * まとめ入力分（備考タグ付き・区分=廃棄）のみを対象にするので、スタッフ入力は消えない。
 */
function removeDuplicateWasteJul2026() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const adj = ss.getSheetByName(SHEET_ADJUST);
  if (!adj) { ui.alert('在庫調整シートがありません。'); return; }
  const TAG = 'スタッフ未入力分の廃棄（7-8月まとめ）';

  // アプリ入力と完全一致する重複 [年, 月(1-12), 日, 商品名, 数量]
  const dups = [
    [2026, 7, 12, 'トマト', 6],
    [2026, 7, 14, 'さくらんぼ', 1],
    [2026, 7, 24, 'さくらんぼ', 1],
    [2026, 7, 24, '紅はるか（焼き芋・大）', 1],
    [2026, 7, 25, 'トマト', 1],
    [2026, 7, 25, 'レタス', 1],
    [2026, 7, 31, 'チンゲン菜', 3],
    [2026, 8,  2, 'トマト', 2],
    [2026, 8,  2, 'レタス', 2],
    [2026, 8,  2, 'さくらんぼ', 1],
  ];
  const specs = dups.map(function (d) {
    return { y: d[0], m: d[1], day: d[2], name: d[3], qty: d[4], done: false };
  });

  const last = adj.getLastRow();
  if (last < 2) { ui.alert('データがありません。'); return; }
  const rows = adj.getRange(2, 1, last - 1, 5).getValues(); // 日付,商品名,区分,数量,備考
  const toDelete = [];
  for (let i = 0; i < rows.length; i++) {
    const dt = rows[i][0];
    const name = String(rows[i][1]).trim();
    const kubun = String(rows[i][2]).trim();
    const qty = Number(rows[i][3]);
    const memo = String(rows[i][4]).trim();
    if (memo !== TAG || kubun !== '廃棄' || !(dt instanceof Date)) continue;
    for (let j = 0; j < specs.length; j++) {
      const s = specs[j];
      if (!s.done && dt.getFullYear() === s.y && (dt.getMonth() + 1) === s.m
          && dt.getDate() === s.day && name === s.name && qty === s.qty) {
        toDelete.push(i + 2); // 実際の行番号
        s.done = true;
        break;
      }
    }
  }
  if (!toDelete.length) { ui.alert('削除対象の重複が見つかりませんでした（すでに削除済みかも）。'); return; }
  toDelete.sort(function (a, b) { return b - a; }); // 下から削除して行ずれ防止
  toDelete.forEach(function (r) { adj.deleteRow(r); });

  recalcAll();
  const notFound = specs.filter(function (s) { return !s.done; })
                        .map(function (s) { return s.m + '/' + s.day + ' ' + s.name; });
  ui.alert('重複削除 完了',
    toDelete.length + '件の重複（まとめ入力分）を削除しました。'
    + (notFound.length ? '\n\n※見つからず: ' + notFound.join(', ') : ''),
    ui.ButtonSet.OK);
}

/**
 * 【1回だけ実行】果物ギフトボックス（まとめ売り4種）を追加する。
 * - ギフト4種を商品マスターに追加（原価=構成果物の合計、価格=セット価格）
 * - 「ギフト販売」ログシートを作成
 * ギフトは受注生産（スタッフが作る）。アプリの「Gift boxes sold today」で販売数を入力すると、
 * 材料の果物が自動で在庫から引かれ、ギフトの売上・粗利が計上される。
 */
function addGiftBoxes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const master = ss.getSheetByName(SHEET_MASTER);

  // ギフト販売ログ
  if (!ss.getSheetByName(SHEET_GIFT_LOG)) {
    const sh = ss.insertSheet(SHEET_GIFT_LOG);
    sh.getRange(1, 1, 1, 5).setValues([['日付','セット名','販売数','入力者','記録時刻']])
      .setFontWeight('bold').setBackground('#a142f4').setFontColor('#ffffff');
    sh.getRange(2, 1, 1000, 1).setNumberFormat('yyyy/mm/dd');
    sh.getRange(2, 5, 1000, 1).setNumberFormat('yyyy/mm/dd hh:mm');
    sh.setFrozenRows(1);
    sh.setColumnWidth(2, 140);
  }

  // 商品マスターにギフト4種を追加（未追加のみ）
  const existing = master.getRange('B2:B' + master.getLastRow()).getValues().flat();
  GIFT_SEED.forEach(function (g, i) {
    if (existing.indexOf(g.name) > -1) return;
    const r = master.getLastRow() + 1;
    master.getRange(r, 1, 1, 7).setValues([['G0' + (i + 1), g.name, g.label, 'セット', 0, g.cost, 0]]);
    master.getRange(r, 8).setFormula('=F' + r + '+G' + r);                    // 実質原価
    master.getRange(r, 9).setValue(g.price);                                  // 販売PHP
    master.getRange(r, 10).setFormula('=I' + r + '*' + SHEET_SETTINGS + '!$B$5'); // 売価JPY
    master.getRange(r, 11).setFormula('=J' + r + '-H' + r);                   // 粗利
    master.getRange(r, 12).setFormula('=IF(J' + r + '=0,0,K' + r + '/J' + r + ')'); // 粗利率
    master.getRange(r, 12).setNumberFormat('0.0%');
    master.getRange(r, 13).setValue(1);       // アラート基準（受注生産なので参考値）
    master.getRange(r, 15).setValue('はい');  // 販売中
  });

  recalcAll();
  ui.alert(
    'ギフト追加 完了',
    '果物ギフト4種を追加しました。\n\n' +
    'スタッフアプリの「🎁 Gift boxes sold today」に販売数を入れると、\n' +
    '材料の果物が自動で在庫から引かれ、ギフトの売上・粗利が計上されます。\n' +
    '（Gift A=緑りんご/シナノ、Gift C=赤りんご/フジ で取り違え防止）',
    ui.ButtonSet.OK
  );
}

function buildOrder_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_ORDER);
  const headers = ['緊急度','商品名','現在在庫','単位','在庫日数','1日平均販売数','完売予測日','発注推奨'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setBackground('#d93025').setFontColor('#ffffff');
  sh.setFrozenRows(1);
}

function buildDashboard_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_DASHBOARD);
  sh.getRange('A1').setValue('📊 ダッシュボード').setFontWeight('bold').setFontSize(16);
  sh.getRange('A2').setValue('（メニュー「青果システム → 全データ再計算」で最新化）').setFontColor('#666666');
}

// ============================================================
// 自動計算（中核）
// ============================================================

/** 設定シートから採用為替レートを取得 */
function getExchangeRate_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const v = ss.getSheetByName(SHEET_SETTINGS).getRange(CELL_RATE_USED).getValue();
  const r = Number(v);
  return (r && r > 0) ? r : 2.6; // 取得失敗時の保険
}

function getAlertThresholds_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const set = ss.getSheetByName(SHEET_SETTINGS);
  return {
    red:    Number(set.getRange(CELL_ALERT_RED).getValue())    || 3,
    yellow: Number(set.getRange(CELL_ALERT_YELLOW).getValue()) || 7,
  };
}

/** シートを配列オブジェクトで読む */
function readTable_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const head = values[0];
  return values.slice(1).filter(row => row.join('') !== '').map(row => {
    const o = {};
    head.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}

function daysBetween_(d1, d2) {
  const ms = (new Date(d2)).setHours(0,0,0,0) - (new Date(d1)).setHours(0,0,0,0);
  return Math.round(ms / 86400000);
}

/**
 * 全データ再計算：分析・発注判断・ダッシュボードを更新
 */
function recalcAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rate = getExchangeRate_();
  const th = getAlertThresholds_();
  const today = new Date();

  const master    = readTable_(SHEET_MASTER);
  const receiving = readTable_(SHEET_RECEIVING);
  const daily     = readTable_(SHEET_DAILY);
  const adjust    = ss.getSheetByName(SHEET_ADJUST) ? readTable_(SHEET_ADJUST) : [];

  // 商品ごとの調整数（廃棄・持出など）を集計
  const adjByName = {};
  adjust.forEach(r => {
    const name = r['商品名'];
    if (!name) return;
    adjByName[name] = (adjByName[name] || 0) + (Number(r['数量']) || 0);
  });

  // 果物ギフト：販売ログを集計し、使った材料を在庫調整に加算（通常販売にしない）
  const giftLog = ss.getSheetByName(SHEET_GIFT_LOG) ? readTable_(SHEET_GIFT_LOG) : [];
  const giftSold = {}; // {セット名: 累計販売数}
  giftLog.forEach(r => {
    const g = r['セット名'];
    const q = Number(r['販売数']) || 0;
    if (!g || q <= 0) return;
    giftSold[g] = (giftSold[g] || 0) + q;
  });
  Object.keys(giftSold).forEach(g => {
    const recipe = GIFT_RECIPE[g] || [];
    recipe.forEach(comp => {
      const mat = comp[0], qty = comp[1];
      adjByName[mat] = (adjByName[mat] || 0) + giftSold[g] * qty; // 材料を在庫から差引
    });
  });
  const giftNameList = giftNames_();

  // 商品ごとに入荷を集計
  const recvByName = {};   // {商品名: {total, firstDate, byDate:{dateStr:qty}}}
  receiving.forEach(r => {
    const name = r['商品名'];
    if (!name) return;
    const qty = Number(r['入荷数']) || 0;
    const d = new Date(r['入荷日']);
    if (!recvByName[name]) recvByName[name] = { total: 0, firstDate: d, byDate: {} };
    recvByName[name].total += qty;
    if (d < recvByName[name].firstDate) recvByName[name].firstDate = d;
    const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    recvByName[name].byDate[key] = (recvByName[name].byDate[key] || 0) + qty;
  });

  // 加工記録（焼き芋など）：元商品の在庫を減らし、加工後商品の在庫を増やす
  const process = ss.getSheetByName(SHEET_PROCESS) ? readTable_(SHEET_PROCESS) : [];
  process.forEach(r => {
    const src = r['元商品'];
    const dst = r['加工後商品'];
    const qty = Number(r['数量']) || 0;
    if (qty <= 0) return;
    const d = new Date(r['日付']);
    // 元商品：加工で減った分は「販売」ではないので調整に加算
    if (src) adjByName[src] = (adjByName[src] || 0) + qty;
    // 加工後商品：入荷（在庫増）として加算（原価は商品マスター基準なので二重計上にならない）
    if (dst) {
      if (!recvByName[dst]) recvByName[dst] = { total: 0, firstDate: d, byDate: {} };
      recvByName[dst].total += qty;
      if (d < recvByName[dst].firstDate) recvByName[dst].firstDate = d;
      const key = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      recvByName[dst].byDate[key] = (recvByName[dst].byDate[key] || 0) + qty;
    }
  });

  // 商品ごとに日次在庫を日付順で集計
  const dailyByName = {};  // {商品名: [{date, stock}]} 日付昇順
  daily.forEach(r => {
    const name = r['商品名'];
    if (!name || r['現在在庫数'] === '' || r['現在在庫数'] === null) return;
    const d = new Date(r['日付']);
    if (!dailyByName[name]) dailyByName[name] = [];
    dailyByName[name].push({ date: d, stock: Number(r['現在在庫数']) });
  });
  Object.keys(dailyByName).forEach(n => dailyByName[n].sort((a, b) => a.date - b.date));

  const analysisRows = [];
  const orderRows = [];
  const dash = {
    totalStockValue: 0, totalExpectedSales: 0, totalExpectedProfit: 0,
    ranking: [], turnover: [], deadstock: [],
  };

  const masterByName = {};
  master.forEach(m => { masterByName[m['商品名']] = m; });

  master.forEach(m => {
    const name = m['商品名'];
    if (giftNameList.indexOf(name) > -1) return; // ギフトは在庫商品ではないので分析対象外
    const unit = m['単位'];
    const active = (m['販売中'] !== 'いいえ'); // いいえ=アプリ非表示・発注/ダッシュボード対象外
    const realCost = Number(m['実質原価JPY']) || (Number(m['仕入原価JPY']) + Number(m['加工費JPY']) || 0);
    const priceJPY = Number(m['販売価格PHP']) * rate;
    const profitJPY = priceJPY - realCost;

    const recv = recvByName[name] || { total: Number(m['初期入荷数']) || 0, firstDate: today, byDate: {} };
    const totalReceived = recv.total;

    const entries = dailyByName[name] || [];
    const last = entries.length ? entries[entries.length - 1] : null;
    const currentStock = last ? last.stock : totalReceived; // 未入力なら入荷数=在庫とみなす

    const adjQty = adjByName[name] || 0;                          // 廃棄・持出など
    const grossOut = Math.max(0, totalReceived - currentStock);   // 在庫から減った総数
    const cumSold = Math.max(0, grossOut - adjQty);               // 真の販売数（廃棄等を除く）

    // 当日販売数
    let todaySold = 0;
    if (entries.length >= 2) {
      const prev = entries[entries.length - 2];
      const key = Utilities.formatDate(last.date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const recvOnDay = recv.byDate[key] || 0;
      todaySold = Math.max(0, prev.stock + recvOnDay - last.stock);
    } else if (entries.length === 1) {
      todaySold = cumSold;
    }

    const sellRate = totalReceived > 0 ? cumSold / totalReceived : 0;
    const remainRate = totalReceived > 0 ? currentStock / totalReceived : 0;

    const daysSince = Math.max(1, daysBetween_(recv.firstDate, today));
    const avgPerDay = cumSold / daysSince;
    const stockDays = avgPerDay > 0 ? currentStock / avgPerDay : (currentStock > 0 ? 999 : 0);

    let selloutDate = '';
    if (avgPerDay > 0 && currentStock > 0) {
      const sd = new Date(today);
      sd.setDate(sd.getDate() + Math.ceil(stockDays));
      selloutDate = sd;
    } else if (currentStock === 0) {
      selloutDate = '完売';
    } else {
      selloutDate = '—';
    }

    const stockValue = currentStock * realCost;
    const expectedSales = currentStock * priceJPY;
    const expectedProfit = currentStock * profitJPY;

    // 発注ステータス
    const alertBase = Number(m['アラート基準在庫数']) || 0;
    let status;
    if (currentStock <= 0) {
      status = '🆘 完売・発注推奨';
    } else if (stockDays <= th.red || currentStock <= alertBase) {
      status = '🔴 至急発注';
    } else if (stockDays <= th.yellow) {
      status = '🟡 発注準備';
    } else {
      status = '🟢 十分';
    }

    analysisRows.push([
      name, unit, totalReceived, currentStock, cumSold, todaySold, adjQty,
      sellRate, remainRate, daysSince, round1_(avgPerDay), round1_(stockDays),
      selloutDate, Math.round(stockValue), Math.round(expectedSales), Math.round(expectedProfit), status
    ]);

    // 発注判断（緑以外を表示。販売停止商品は対象外）
    if (active && status.indexOf('🟢') === -1) {
      const urgency = status.indexOf('🆘') > -1 ? 0 : status.indexOf('🔴') > -1 ? 1 : 2;
      orderRows.push([
        urgency, name, currentStock, unit, round1_(stockDays), round1_(avgPerDay), selloutDate,
        urgency <= 1 ? '今すぐ入荷依頼' : '入荷準備'
      ]);
    }

    // ダッシュボードは販売中の商品のみ集計
    if (!active) return;

    dash.totalStockValue += stockValue;
    dash.totalExpectedSales += expectedSales;
    dash.totalExpectedProfit += expectedProfit;
    dash.ranking.push({ name, cumSold });
    dash.turnover.push({ name, sellRate });
    dash.deadstock.push({ name, sellRate, daysSince, currentStock });
  });

  // 🎁 ギフト販売サマリー
  dash.gifts = GIFT_SEED.map(g => {
    const m = masterByName[g.name] || {};
    const priceJPY = (Number(m['販売価格PHP']) || g.price) * rate;
    const cost = Number(m['実質原価JPY']) || g.cost;
    const sold = giftSold[g.name] || 0;
    return {
      label: g.label,
      sold: sold,
      revenue: Math.round(sold * priceJPY),
      profit: Math.round(sold * (priceJPY - cost))
    };
  });

  writeAnalysis_(ss, analysisRows);
  writeOrder_(ss, orderRows, th);
  writeDashboard_(ss, dash, rate);
}

function round1_(n) { return Math.round(n * 10) / 10; }

function writeAnalysis_(ss, rows) {
  const sh = ss.getSheetByName(SHEET_ANALYSIS);
  const nCols = ANALYSIS_HEADERS.length; // 17
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), nCols).clearContent();
  if (!rows.length) return;
  const n = rows.length;
  sh.getRange(2, 1, n, nCols).setValues(rows);
  // 書式をリセットしてから再適用（レイアウト変更時の書式残りを防ぐ）
  sh.getRange(2, 3, n, nCols - 2).setNumberFormat('General');
  sh.getRange(2, 7, n, 1).setNumberFormat('0');            // 廃棄・調整数
  sh.getRange(2, 8, n, 2).setNumberFormat('0.0%');         // 販売率・残在庫率
  sh.getRange(2, 10, n, 1).setNumberFormat('0');           // 入荷からの日数
  sh.getRange(2, 11, n, 2).setNumberFormat('0.0');         // 1日平均・在庫日数
  sh.getRange(2, 13, n, 1).setNumberFormat('yyyy/mm/dd');  // 完売予測日
  sh.getRange(2, 14, n, 3).setNumberFormat('#,##0');       // 金額
  sh.autoResizeColumns(1, nCols);
}

function writeOrder_(ss, rows, th) {
  const sh = ss.getSheetByName(SHEET_ORDER);
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), 8).clearContent();
  sh.clearConditionalFormatRules();
  if (!rows.length) {
    sh.getRange('A2').setValue('✅ 発注が必要な商品はありません（すべて十分在庫）');
    return;
  }
  rows.sort((a, b) => a[0] - b[0]); // 緊急度順
  // 緊急度の数値を表示用ラベルに
  const labeled = rows.map(r => {
    const lbl = r[0] === 0 ? '🆘完売' : r[0] === 1 ? '🔴至急' : '🟡準備';
    return [lbl, r[1], r[2], r[3], r[4], r[5], r[6], r[7]];
  });
  sh.getRange(2, 1, labeled.length, 8).setValues(labeled);
  sh.getRange(2, 7, labeled.length, 1).setNumberFormat('yyyy/mm/dd');

  // 行の色分け
  const range = sh.getRange(2, 1, labeled.length, 8);
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=OR($A2="🆘完売",$A2="🔴至急")').setBackground('#fce8e6').setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$A2="🟡準備"').setBackground('#fef7e0').setRanges([range]).build(),
  ];
  sh.setConditionalFormatRules(rules);
  sh.autoResizeColumns(1, 8);
}

function writeDashboard_(ss, dash, rate) {
  const sh = ss.getSheetByName(SHEET_DASHBOARD);
  sh.clear();
  sh.getRange('A1').setValue('📊 ダッシュボード').setFontWeight('bold').setFontSize(16);
  sh.getRange('A2').setValue('更新: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm')
    + '　／　採用為替: 1 PHP = ' + round1_(rate * 100) / 100 + ' JPY').setFontColor('#666666');

  // KPI
  sh.getRange('A4').setValue('💰 経営サマリー（残在庫ベース）').setFontWeight('bold').setFontSize(12);
  const kpi = [
    ['在庫金額（原価）JPY', Math.round(dash.totalStockValue)],
    ['想定売上 JPY',        Math.round(dash.totalExpectedSales)],
    ['想定粗利 JPY',        Math.round(dash.totalExpectedProfit)],
  ];
  sh.getRange(5, 1, 3, 2).setValues(kpi);
  sh.getRange(5, 1, 3, 1).setFontWeight('bold');
  sh.getRange(5, 2, 3, 1).setNumberFormat('#,##0').setFontSize(12);

  // 売れ筋ランキング
  let row = 9;
  sh.getRange(row, 1).setValue('🔥 売れ筋ランキング（累計販売数）').setFontWeight('bold');
  row++;
  sh.getRange(row, 1, 1, 2).setValues([['商品名','累計販売数']]).setFontWeight('bold').setBackground('#e8f0fe');
  const top = dash.ranking.slice().sort((a, b) => b.cumSold - a.cumSold).slice(0, 10);
  top.forEach((x, i) => sh.getRange(row + 1 + i, 1, 1, 2).setValues([[x.name, x.cumSold]]));

  // 回転率ランキング
  let row2 = 9; const col = 4;
  sh.getRange(row2, col).setValue('♻ 回転率ランキング（販売率）').setFontWeight('bold');
  row2++;
  sh.getRange(row2, col, 1, 2).setValues([['商品名','販売率']]).setFontWeight('bold').setBackground('#e6f4ea');
  const turn = dash.turnover.slice().sort((a, b) => b.sellRate - a.sellRate).slice(0, 10);
  turn.forEach((x, i) => {
    sh.getRange(row2 + 1 + i, col).setValue(x.name);
    sh.getRange(row2 + 1 + i, col + 1).setValue(x.sellRate).setNumberFormat('0.0%');
  });

  // 売れ残り（販売率が低い順）
  let row3 = 9; const col3 = 7;
  sh.getRange(row3, col3).setValue('🐌 売れ残り注意（販売率 低い順）').setFontWeight('bold');
  row3++;
  sh.getRange(row3, col3, 1, 3).setValues([['商品名','販売率','残在庫']]).setFontWeight('bold').setBackground('#fce8e6');
  const dead = dash.deadstock.slice()
    .filter(x => x.currentStock > 0)
    .sort((a, b) => a.sellRate - b.sellRate).slice(0, 10);
  dead.forEach((x, i) => {
    sh.getRange(row3 + 1 + i, col3).setValue(x.name);
    sh.getRange(row3 + 1 + i, col3 + 1).setValue(x.sellRate).setNumberFormat('0.0%');
    sh.getRange(row3 + 1 + i, col3 + 2).setValue(x.currentStock);
  });

  // 🎁 ギフト販売サマリー
  if (dash.gifts && dash.gifts.length) {
    let gr = 22;
    sh.getRange(gr, 1).setValue('🎁 ギフト販売（累計）').setFontWeight('bold').setFontSize(12);
    gr++;
    sh.getRange(gr, 1, 1, 4).setValues([['ギフト','販売数','売上JPY','粗利JPY']])
      .setFontWeight('bold').setBackground('#f3e8fd');
    dash.gifts.forEach((g, i) => {
      sh.getRange(gr + 1 + i, 1, 1, 4).setValues([[g.label, g.sold, g.revenue, g.profit]]);
    });
    const gtot = gr + 1 + dash.gifts.length;
    const sumSold = dash.gifts.reduce((s, g) => s + g.sold, 0);
    const sumRev  = dash.gifts.reduce((s, g) => s + g.revenue, 0);
    const sumPro  = dash.gifts.reduce((s, g) => s + g.profit, 0);
    sh.getRange(gtot, 1, 1, 4).setValues([['合計', sumSold, sumRev, sumPro]]).setFontWeight('bold');
    sh.getRange(gr + 1, 3, dash.gifts.length + 1, 2).setNumberFormat('#,##0');
  }

  sh.autoResizeColumns(1, 9);
}

// ============================================================
// トリガー
// ============================================================
function installTriggers_() {
  // 既存トリガー削除（重複防止）
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['recalcAll', 'onEditRecalc'].indexOf(t.getHandlerFunction()) > -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // 毎朝6時に自動再計算
  ScriptApp.newTrigger('recalcAll').timeBased().atHour(6).everyDays(1).create();
  // 日次在庫が編集されたら再計算
  ScriptApp.newTrigger('onEditRecalc').forSpreadsheet(ss).onEdit().create();
}

function onEditRecalc(e) {
  if (!e || !e.range) return;
  const name = e.range.getSheet().getName();
  if (name === SHEET_DAILY || name === SHEET_ADJUST || name === SHEET_PROCESS || name === SHEET_GIFT_LOG) {
    recalcAll();
  }
}

function showWebAppHelp() {
  SpreadsheetApp.getUi().alert(
    'スタッフ用Webアプリの公開手順',
    '1. 上部メニュー「拡張機能 → Apps Script」を開く\n' +
    '2. 右上「デプロイ → 新しいデプロイ」をクリック\n' +
    '3. 種類の選択（歯車）→「ウェブアプリ」\n' +
    '4. アクセスできるユーザー →「全員」\n' +
    '5. 「デプロイ」→ 表示されたURLをスタッフのスマホに共有\n\n' +
    '※詳しくは docs/スタッフ向け入力手順.md を参照',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
