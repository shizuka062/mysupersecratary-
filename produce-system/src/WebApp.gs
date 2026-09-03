/**
 * スタッフ用 Webアプリ（スマホ入力画面）
 * ===========================================================
 * doGet : 入力画面を表示
 * getProductList : 商品一覧＋現在在庫を返す
 * submitStock : スタッフが入力した在庫数を「日次在庫」に保存
 * ===========================================================
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('StaffInput')
    .setTitle('Midori No Mart 在庫入力')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/** 商品名・単位・現在在庫（最新値）の一覧を返す */
function getProductList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = readTable_(SHEET_MASTER);
  const daily = readTable_(SHEET_DAILY);

  // 商品ごとの最新在庫
  const latest = {};
  daily.forEach(r => {
    const name = r['商品名'];
    if (!name || r['現在在庫数'] === '' || r['現在在庫数'] === null) return;
    const d = new Date(r['日付']).getTime();
    if (!latest[name] || d >= latest[name].t) {
      latest[name] = { t: d, stock: Number(r['現在在庫数']) };
    }
  });

  const gifts = giftNames_();
  return master
    .filter(m => m['販売中'] !== 'いいえ' && gifts.indexOf(m['商品名']) === -1) // 販売停止・ギフトは通常一覧に出さない
    .map(m => ({
      name: m['商品名'],                                  // 内部キー（日本語）＝保存用
      nameEN: m['英語名'] || m['商品名'],                  // スタッフ画面の表示名（英語）
      unit: UNIT_EN[m['単位']] || m['単位'],               // 単位（英語）
      processTo: m['加工先商品'] || '',                     // 加工先（あればアプリにBaked欄を表示）
      lastStock: latest[m['商品名']] ? latest[m['商品名']].stock : ''
    }));
}

/** 果物ギフト一覧（受注生産・アプリの「Gift boxes sold today」用） */
function getGiftList() {
  return GIFT_SEED.map(g => ({
    name: g.name, label: g.label, en: g.en, price: g.price, accent: g.accent
  }));
}

/**
 * 在庫数＋廃棄数＋試食数＋ギフト販売数を保存
 * @param {Array} list  [{name, stock, waste, tasting}]  空文字なら未入力扱い
 * @param {String} staff 入力者名
 * @param {String} dateStr 記録日 'yyyy-MM-dd'（過去日も可。未指定なら今日）
 * @param {Array} gifts [{name, sold}] ギフト販売数（同日・同セットは上書き）
 */
function submitStock(list, staff, dateStr, gifts) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_DAILY);
  const adj = ss.getSheetByName(SHEET_ADJUST);
  const proc = ss.getSheetByName(SHEET_PROCESS);
  const now = new Date();

  // 商品名 → 加工先商品 のマップ（焼き芋など）
  const processMap = {};
  readTable_(SHEET_MASTER).forEach(m => {
    if (m['加工先商品']) processMap[m['商品名']] = m['加工先商品'];
  });
  let recDate;
  if (dateStr) {
    const p = String(dateStr).split('-');
    recDate = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  } else {
    recDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const today = recDate;
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(recDate, tz, 'yyyy-MM-dd');

  // 同日・同商品の既存行を探す（上書き運用）
  const values = sh.getDataRange().getValues();
  const indexByKey = {};
  for (let i = 1; i < values.length; i++) {
    const d = values[i][0];
    const name = values[i][1];
    if (!d || !name) continue;
    const ds = Utilities.formatDate(new Date(d), tz, 'yyyy-MM-dd');
    indexByKey[ds + '|' + name] = i + 1; // 1-based row
  }

  // 在庫調整シートの既存「アプリ入力」行を探す（同日・同商品・同区分で上書き）
  let adjIndex = {};
  if (adj) {
    const av = adj.getDataRange().getValues();
    for (let i = 1; i < av.length; i++) {
      const d = av[i][0], nm = av[i][1], kbn = av[i][2], reason = av[i][4];
      if (!d || !nm) continue;
      const ds = Utilities.formatDate(new Date(d), tz, 'yyyy-MM-dd');
      if (reason === 'アプリ入力') adjIndex[ds + '|' + nm + '|' + kbn] = i + 1;
    }
  }

  // 在庫調整への書き込み（区分ごとに同日・同商品で上書き）
  function writeAdj(name, kbn, qty) {
    if (!adj || qty === '' || qty === null || !(Number(qty) > 0)) return;
    const arow = [today, name, kbn, Number(qty), 'アプリ入力'];
    const akey = todayStr + '|' + name + '|' + kbn;
    if (adjIndex[akey]) {
      adj.getRange(adjIndex[akey], 1, 1, 5).setValues([arow]); // 上書き
    } else {
      adj.appendRow(arow);
    }
  }

  // 加工記録シートの既存「アプリ入力」行を探す（同日・元商品・加工後商品で上書き）
  let procIndex = {};
  if (proc) {
    const pv = proc.getDataRange().getValues();
    for (let i = 1; i < pv.length; i++) {
      const d = pv[i][0], src = pv[i][1], dst = pv[i][2], note = pv[i][4];
      if (!d || !src) continue;
      const ds = Utilities.formatDate(new Date(d), tz, 'yyyy-MM-dd');
      if (note === 'アプリ入力') procIndex[ds + '|' + src + '|' + dst] = i + 1;
    }
  }

  // 加工記録への書き込み（焼き芋など）
  function writeProcess(name, qty) {
    const dst = processMap[name];
    if (!proc || !dst || qty === '' || qty === null || !(Number(qty) > 0)) return;
    const prow = [today, name, dst, Number(qty), 'アプリ入力'];
    const pkey = todayStr + '|' + name + '|' + dst;
    if (procIndex[pkey]) {
      proc.getRange(procIndex[pkey], 1, 1, 5).setValues([prow]); // 上書き
    } else {
      proc.appendRow(prow);
    }
  }

  let saved = 0;
  list.forEach(item => {
    // ① 在庫数 → 日次在庫
    if (item.stock !== '' && item.stock !== null && !isNaN(Number(item.stock))) {
      const row = [today, item.name, Number(item.stock), staff || '', now];
      const key = todayStr + '|' + item.name;
      if (indexByKey[key]) {
        sh.getRange(indexByKey[key], 1, 1, 5).setValues([row]); // 上書き
      } else {
        sh.appendRow(row);
      }
      saved++;
    }
    // ② 廃棄・③ 試食 → 在庫調整
    writeAdj(item.name, '廃棄', item.waste);
    writeAdj(item.name, '試食', item.tasting);
    // ④ 加工（焼き芋など）→ 加工記録
    writeProcess(item.name, item.baked);
  });

  // ⑤ ギフト販売 → ギフト販売ログ（同日・同セットは上書き）
  const giftSheet = ss.getSheetByName(SHEET_GIFT_LOG);
  if (giftSheet && gifts && gifts.length) {
    const gv = giftSheet.getDataRange().getValues();
    const gIndex = {};
    for (let i = 1; i < gv.length; i++) {
      const d = gv[i][0], nm = gv[i][1];
      if (!d || !nm) continue;
      const ds = Utilities.formatDate(new Date(d), tz, 'yyyy-MM-dd');
      gIndex[ds + '|' + nm] = i + 1;
    }
    gifts.forEach(g => {
      if (!(Number(g.sold) > 0)) return;
      const grow = [today, g.name, Number(g.sold), staff || '', now];
      const gkey = todayStr + '|' + g.name;
      if (gIndex[gkey]) {
        giftSheet.getRange(gIndex[gkey], 1, 1, 5).setValues([grow]); // 上書き
      } else {
        giftSheet.appendRow(grow);
      }
    });
  }

  recalcAll();
  return saved;
}
