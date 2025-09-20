// Netlify Functions 経由
const ENDPOINT = '/.netlify/functions/submit';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('entryForm');
  const msg  = document.getElementById('msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '送信中…';

    const data = Object.fromEntries(new FormData(form).entries());

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
      ['height_cm','身長'],
      ['weight_now_kg','現在体重'],
      ['phone','電話番号'],
      ['line_id','LINE ID']
      // email は任意
    ];
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
