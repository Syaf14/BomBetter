// Text channel between the Deaf and Mute players.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createChat(root, { me, other, send, quick = [], readOnly = false }) {
  root.innerHTML = `<div class="chat">
    <div class="chat-log" aria-live="polite"></div>
    ${quick.length && !readOnly ? `<div class="chat-quick">${quick.map((q) => `<button type="button">${esc(q)}</button>`).join('')}</div>` : ''}
    ${readOnly ? '' : `<form class="chat-form"><input maxlength="200" placeholder="Message to ${other}…" autocomplete="off"><button>Send</button></form>`}
  </div>`;
  const log = root.querySelector('.chat-log');
  const input = root.querySelector('input');
  const post = (text) => text.trim() && send({ t: 'chat', as: me, text: text.trim() });
  if (!readOnly) root.querySelector('form').onsubmit = (e) => { e.preventDefault(); post(input.value); input.value = ''; };
  root.querySelectorAll('.chat-quick button').forEach((b) => (b.onclick = () => post(b.textContent)));
  return {
    add(msg) {
      const div = document.createElement('div');
      div.className = `msg ${msg.from === me ? 'me' : 'them'}`;
      div.innerHTML = `<b>${msg.from === me ? 'You' : msg.from}</b> ${esc(msg.text)}`;
      log.append(div);
      log.scrollTop = log.scrollHeight;
    },
  };
}
