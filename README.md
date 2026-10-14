# BomBetter

A cooperative bomb-defusal game for three players, each missing a sense.

| Role | Sees bomb | Hears | Speaks | Job |
|------|-----------|-------|--------|-----|
| 🙈 Blind | no (dark screen) | yes | – | Presses/cuts on the bomb as told |
| 🙉 Deaf | yes | no | voice to Blind, text to Mute | Describes the bomb, relays instructions |
| 🤐 Mute | no | – | text only | Reads the manual |

Chain: **Mute** reads the manual → texts **Deaf** → speaks to **Blind** → acts on the bomb.
The manual rules are regenerated from a random seed every game.

Modules: Wires, Big Button, Keypad, Simon Says, Memory, Morse Code.

## Extras

- **Emote wheel (Mute):** press `X` (or hold the ✋ button and drag on a phone), aim at a slot and click or release. The Deaf player sees a big hand pop up (1-10 fingers, yes, no) and it is logged in chat.
- **Decorated room:** the lobby and the Deaf and Mute screens show the same randomly decorated room (paintings in green, blue, yellow and red; a ball, crate, cone and so on). It is purely cosmetic: it just gives players shapes and colours to talk about. The Blind player has no visuals. A 🖼 Room button hides it.

## Run

ES modules need a web server (not `file://`):

```bash
npx serve .
```

Open the printed URL. Players on other devices open the same site (it must be reachable by them, e.g. deploy the folder to GitHub Pages / Netlify, or use your LAN IP).

- **Host a game** creates a room; share the 4-letter code or the `?room=CODE` link.
- The **host's browser is the server** (WebRTC via PeerJS). Keep the host tab open and in the foreground.
- **Solo test** plays all three roles on one device, offline.
- Live voice (Deaf → Blind) needs HTTPS (or localhost) for the microphone. Otherwise the Deaf player can use the "type to speak" box, which is read aloud on the Blind device.

## Layout

- `src/game.js` bomb generation + authoritative state (host only)
- `src/host.js` lobby, roles, message routing and permissions
- `src/net.js` PeerJS wrappers
- `src/modules/*.js` one file per module: rules, manual text, Deaf view, Blind controls
- `src/roles/*.js` the three role screens
