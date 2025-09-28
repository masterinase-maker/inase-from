// Netlify Functions 経由
const ENDPOINT = '/.netlify/functions/submit';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('entryForm');
  const msg  = document.getElementById('msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '送信中…';

  //   // const data = Object.fromEntries(new FormData(form).entries());
  //   // 既存：const data = Object.fromEntries(new FormData(form).entries());
  //   const fd = new FormData(form); // ↑を変更して新しく変更

  //   // --- ここを追加：画像をBase64に変換して payload に含める ---
  //   try {
  //     const photoPayload = await fileToBase64Payload(
  //       form.querySelector('input[name="photo_file"]')
  //     );
  //     if (photoPayload) Object.assign(data, photoPayload);
  //   } catch (e) {
  //     msg.textContent = '画像エラー：' + e.message;
  //     return;
  //   }
  // // --- 追加ここまで ---

    // フォーム値 → FormData → プレーンオブジェクト
    const fd   = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    // 画像をBase64に変換して data に載せる
    try {
      const photoPayload = await fileToBase64Payload(
        form.querySelector('input[name="photo_file"]')
      );
      if (photoPayload) Object.assign(data, photoPayload);
    } catch (e) {
      msg.textContent = '画像エラー：' + e.message;
      return;
    }


    // ---- honeypot
    if (data.hp_secret && data.hp_secret.trim() !== '') {
      msg.textContent = '送信完了しました。ありがとうございます。';
      form.reset();
      return;
    }

    // ---- 強い検証（テキスト系 / ラジオ / チェック別々に）
    const missing = [];

    const needText = [
      ['full_name','氏名'],
      ['furigana','フリガナ'],
      ['birthdate','生年月日'],
      ['address','住所'],
      ['affiliation','所属'],
      ['exp_years','経験年数（年）'],   // ← 数値入力
      ['fights_total','総試合数'],       // ← 数値入力
      ['wins','勝'],                     // ← 数値入力
      ['losses','敗'],                   // ← 数値入力
      ['height_cm','身長'],
      ['weight_now_kg','現在体重'],
      ['phone','電話番号'],
      // ['line_id','LINE ID']
      // email は任意
    ];
    // 数値に正規化
    const F = Math.max(0, parseInt(data.fights_total, 10) || 0);
    const W = Math.max(0, parseInt(data.wins, 10) || 0);
    const L = Math.max(0, parseInt(data.losses, 10) || 0);

    // 経験年数は小数OK
    const Y = Math.max(0, parseFloat(data.exp_years) || 0);
    data.exp_years    = String(Y);               // ← これだけでOK
    data.fights_total = String(Math.max(F, W+L));
    // スプレッドシート用 表示文字列（1列）
    data.record_text = `${data.fights_total}戦 ${data.wins}勝 ${data.losses}敗`;
    // テキスト系
    for (const [key,label] of needText) {
      if (!data[key] || String(data[key]).trim() === '') missing.push(label);
    }

    // ラジオ（体重のボタン群）
    const weightRadioChecked =
      form.querySelector('input[name="weight_base_kg"]:checked') ||
      form.querySelector('input[name="weight_class"]:checked');
    if (!weightRadioChecked) missing.push('希望試合体重');

    // チェックボックス（ルール同意）
    const agreeRulesEl = form.querySelector('input[name="agree_rules"]');
    const agreedRules  = !!(agreeRulesEl && agreeRulesEl.checked);
    if (!agreedRules) missing.push('ルール同意');

    // チェックボックス（大会趣旨同意）※新規
    const agreeStmtEl  = form.querySelector('input[name="agree_statement"]');
    const agreedStmt   = !!(agreeStmtEl && agreeStmtEl.checked);
    if (!agreedStmt) missing.push('大会趣旨への同意');

    // 画像必須
    if (!data.photo_base64) {
      missing.push('選手写真')
    }

    if (missing.length) {
      msg.textContent = `未入力の必須項目：${missing.join('、')}`;

      // 足りない最初の要素へスクロール
      const firstMissEl =
        form.querySelector('[name="weight_base_kg"]')?.closest('fieldset') ||
        form.querySelector('[name="weight_class"]')?.closest('fieldset') ||
        form.querySelector(`[name="${needText.find(([k,l])=>missing.includes(l))?.[0]}"]`) ||
        (!agreedRules ? agreeRulesEl : null) ||
        (!agreedStmt  ? agreeStmtEl  : null);

      firstMissEl?.scrollIntoView({behavior:'smooth', block:'center'});
      return;
    }

    // ---- 送信payloadを整える
    const pickedWeight = weightRadioChecked ? weightRadioChecked.value : '';
    // どちらの名前でもGASが読めるよう両方入れる
    data.weight_base_kg = pickedWeight;
    data.weight_class   = pickedWeight;

    // チェックは 'true' / '' に
    data.agree_rules     = agreedRules ? 'true' : '';
    data.agree_statement = agreedStmt  ? 'true' : '';

    try {
//       // デバッグ：送信前のpayloadを確認
// console.log("送信payload before fetch", data);

      const res  = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.ok) {
        msg.textContent = '送信完了しました。ありがとうございます。';
        form.reset();
      } else {
        msg.textContent = '送信失敗：' + (json.error || 'unknown error');
      }
    } catch (err) {
      msg.textContent = '通信エラー：' + err;
    }
  });
});

// 画像処理のため、新しく追加
// 画像ファイルを Base64 へ。大きい画像はリサイズ＆圧縮して 10MB未満に収める
async function fileToBase64Payload(inputEl) {
  const f = inputEl?.files?.[0];
  if (!f) return null;

  // 1) 4MB超なら簡易圧縮（JPEG化・長辺1200px）
  let blob = f;
  if (f.size > 4 * 1024 * 1024) {
    blob = await downscaleImage(f, { maxSize: 1200, quality: 0.85 });
  }

  // 2) 最終サイズが10MB以上は拒否（Netlify Functionsの制限のため）
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error('画像が大きすぎます（10MB未満にしてください）');
  }

  // 3) Base64化
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    fr.readAsDataURL(blob);
  });

  const m = String(dataUrl).match(/^data:(.*?);base64,(.*)$/);
  if (!m) throw new Error('画像の変換に失敗しました');

  // 拡張子は元ファイルを尊重（ただし圧縮時は jpeg）
  const ext  = blob.type.includes('jpeg') ? 'jpg'
            : blob.type.split('/')[1] || 'bin';
  const name = (f.name || 'photo').replace(/\.[^.]+$/, '') + '.' + ext;

  return {
    photo_name: name,        // 例: player.jpg
    photo_type: blob.type,   // 例: image/jpeg
    photo_base64: m[2],      // Base64本体
  };
}

// 画像を <canvas> で縮小＆JPEG圧縮
function downscaleImage(file, { maxSize = 1200, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const w = Math.round(width * scale);
      const h = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('画像の圧縮に失敗しました'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = URL.createObjectURL(file);
  });
}


// // Netlify Functions 経由
// const ENDPOINT = '/.netlify/functions/submit';

// document.addEventListener('DOMContentLoaded', () => {
//   const form = document.getElementById('entryForm');
//   const msg  = document.getElementById('msg');

//   form.addEventListener('submit', async (e) => {
//     e.preventDefault();
//     msg.textContent = '送信中…';

//     const data = Object.fromEntries(new FormData(form).entries());

//     // ---- honeypot
//     if (data.hp_secret && data.hp_secret.trim() !== '') {
//       msg.textContent = '送信完了しました。ありがとうございます。';
//       form.reset();
//       return;
//     }

//     // ---- 強い検証（テキスト系 / ラジオ / チェック別々に）
//     const missing = [];

//     const needText = [
//       ['full_name','氏名'],
//       ['furigana','フリガナ'],
//       ['birthdate','生年月日'],
//       ['address','住所'],
//       ['affiliation','所属'],
//       ['height_cm','身長'],
//       ['weight_now_kg','現在体重'],
//       // ['discipline','格闘技経験・種目'],
//       ['phone','電話番号'],
//       ['line_id','LINE ID']
//       // email は任意
//     ];
//     // テキスト系
//     for (const [key,label] of needText) {
//       if (!data[key] || String(data[key]).trim() === '') missing.push(label);
//     }

//     // ラジオ（体重のボタン群）
//     const weightRadioChecked =
//       form.querySelector('input[name="weight_base_kg"]:checked') ||
//       form.querySelector('input[name="weight_class"]:checked');
//     if (!weightRadioChecked) missing.push('希望試合体重');

//     // チェックボックス（ルール同意）
//     const agree = form.querySelector('input[name="agree_rules"]');
//     const agreed = !!(agree && agree.checked);
//     if (!agreed) missing.push('ルール同意');

//     if (missing.length) {
//       msg.textContent = `未入力の必須項目：${missing.join('、')}`;
//       // 足りない最初の要素へスクロール
//       const firstMissEl =
//         form.querySelector('[name="weight_base_kg"]')?.closest('fieldset') ||
//         form.querySelector('[name="weight_class"]')?.closest('fieldset') ||
//         form.querySelector(`[name="${needText.find(([k,l])=>missing.includes(l))?.[0]}"]`) ||
//         form.querySelector('[name="agree_rules"]');
//       firstMissEl?.scrollIntoView({behavior:'smooth', block:'center'});
//       return;
//     }

//     // ---- 送信payloadを整える（ラジオ値を入れる／同意を 'on'→true に）
//     const pickedWeight =
//       weightRadioChecked ? weightRadioChecked.value : '';
//     // どちらの名前でもGASが読めるよう両方入れる
//     data.weight_base_kg = pickedWeight;
//     data.weight_class   = pickedWeight;
//     data.agree_rules    = agreed ? 'true' : '';

//     try {
//       const res  = await fetch(ENDPOINT, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(data)
//       });
//       const json = await res.json();
//       if (json.ok) {
//         msg.textContent = '送信完了しました。ありがとうございます。';
//         form.reset();
//       } else {
//         msg.textContent = '送信失敗：' + (json.error || 'unknown error');
//       }
//     } catch (err) {
//       msg.textContent = '通信エラー：' + err;
//     }
//   });
// });
