// Netlify Functions（サーバ中継）へ送る。GASのURLはフロントに書かない
const ENDPOINT = '/.netlify/functions/submit';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('entryForm');
  const msg  = document.getElementById('msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '送信中…';

    const data = Object.fromEntries(new FormData(form).entries());

    // honeypot：埋まってたらサイレント成功
    if (data.hp_secret && data.hp_secret.trim() !== '') {
      msg.textContent = '送信完了しました。ありがとうございます。';
      form.reset();
      return;
    }

    // 必須チェック（必要に応じて調整）
    const required = ['first_name','last_name','birthdate','email','address','affiliation',
                      'height_cm','weight_now_kg','weight_class','discipline','phone','line_id'];
    for (const k of required) { if (!data[k]) { msg.textContent = '未入力の必須項目があります。'; return; } }

    try {
      const res  = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.ok) { msg.textContent = '送信完了しました。ありがとうございます。'; form.reset(); }
      else { msg.textContent = '送信失敗：' + (json.error || 'unknown error'); }
    } catch (err) {
      msg.textContent = '通信エラー：' + err;
    }
  });
});
