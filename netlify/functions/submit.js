


// // Netlify Functions: 中継API。ブラウザ → ここ → GAS(/exec)
// export const handler = async (event) => {
//   const origin = event.headers?.origin || '*';
//   const cors = {
//     'Access-Control-Allow-Origin': origin,
//     'Vary': 'Origin',
//     'Access-Control-Allow-Headers': 'Content-Type',
//     'Access-Control-Allow-Methods': 'POST, OPTIONS',
//   };

//   if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
//   if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

//   try {
//     const data = JSON.parse(event.body || '{}');

//     // honeypot（任意）
//     if (data.hp_secret && String(data.hp_secret).trim() !== '') {
//       return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
//     }

//     // GAS の /exec は環境変数に置く（ブラウザから見えない）
//     const endpoint = process.env.GAS_ENDPOINT;
//     if (!endpoint) throw new Error('GAS_ENDPOINT is not set');

//     // GASへはURLエンコードで送ると相性◎
//     const params = new URLSearchParams(data);

//     const resp = await fetch(endpoint, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
//       body: params
//     });

//     // GASがJSON返す前提。非JSONでもok:trueにフォールバック
//     let json = { ok: true };
//     try { json = await resp.json(); } catch {}
//     return { statusCode: 200, headers: cors, body: JSON.stringify(json) };
//   } catch (err) {
//     return { statusCode: 500, headers: cors, body: JSON.stringify({ ok:false, error:String(err) }) };
//   }
// };

export const handler = async (event) => {
  const origin = event.headers?.origin || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body || '{}');

    // honeypot
    if (data.hp_secret && String(data.hp_secret).trim() !== '') {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, skipped: 'honeypot' }) };
    }

    const endpoint = process.env.GAS_ENDPOINT;
    if (!endpoint) throw new Error('GAS_ENDPOINT is not set');

    // ログ（Functionsのinvocationログで確認できます）
    console.log('POST to GAS:', endpoint);
    console.log('payload keys:', Object.keys(data));

    // const params = new URLSearchParams(data);
    // const resp = await fetch(endpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    //   body: params
    // });
    // ↑前ので↓追加：JSONそのまま中継（Base64を壊さない）
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log('photo_base64 length:', (data.photo_base64 || '').length);

    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!resp.ok) {
      // ステータス異常はそのままエラーにする
      console.error('GAS error status:', resp.status, text);
      return {
        statusCode: 502,
        headers: cors,
        body: JSON.stringify({ ok: false, error: `GAS ${resp.status}`, detail: text.slice(0, 500) })
      };
    }

    if (!json) {
      // JSONで返ってこなかった場合もエラー扱い
      console.error('GAS returned non-JSON:', text);
      return {
        statusCode: 502,
        headers: cors,
        body: JSON.stringify({ ok: false, error: 'GAS returned non-JSON', detail: text.slice(0, 500) })
      };
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify(json) };
  } catch (err) {
    console.error('submit handler failed:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
