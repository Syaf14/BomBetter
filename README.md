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
- **First-person seats (3D, three.js):** each player sees only what is in front of their seat. Blind and Deaf sit opposite each other across a table with the bomb; Mute sits next to Deaf with the manual. Drag (mouse or touch) or use the arrow keys to turn your head a little; click a module to lean in, press Esc or click the case to sit back. The bomb always faces the viewer, so "first / left / top" means the same thing for Deaf and Blind.
  - **Deaf** sees the bomb as it really is: timer, strike lights, serial/battery/indicators and every module in its real colours (wires, button, keypad symbols, Simon lights, Memory display, Morse lamp). Turn your head left to see the Mute player.
  - **Blind** gets the same room in greyscale (built that way, not filtered) with a featureless bomb: grey plates marked only with touch dots for their number. Click a plate to select that module, then use the pads (or the arrows). It is built only from the room seed and which modules are solved, so it never reveals bomb data.
  - **Mute** sees the Deaf player across the desk; when you send an emote your own hand rises with the sign in a bubble, and Deaf sees the Mute stickman do the same.
  - The stickmen: Blind wears a blindfold and holds a cane, Deaf wears crossed-out headphones, Mute has taped lips. They flinch on a strike, cheer on a win and slump on a boom.
  - The decorated room (paintings in green, blue, yellow and red; a ball, crate, cone and so on) is seeded, so everyone sees the same one and it gives players shapes and colours to talk about. The lobby shows it in an overview with all three stickmen.
- **2D fallback:** the 🎲 button toggles 3D off (remembered). If three.js or WebGL is unavailable, Deaf falls back to the module cards, Mute and the lobby to the old 2D room strip, and Blind keeps just the pads.

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
- `src/3d/*.js` the 3D layer: `scene.js` (lazy three.js + renderer/loop), `world.js` (per-seat scenes), `look.js` (head-turn camera, picking, lean-in), `bomb3d.js`, `room3d.js`, `stickman.js`, `mono.js` (greyscale palette), `stage.js` (`mountScene` adds the 3D toggle and fallback). three.js is loaded from a CDN via the import map in `index.html`.
- `src/modules/*.js` also export `draw3d(ctx, view, w, h)`, which paints a module onto the Deaf player's 3D bomb.
