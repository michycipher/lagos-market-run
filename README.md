# Lagos Market Run

A real 3D street-crossing game made for [start.ng](https://start.ng/games), using a locally included Three.js r180 (MIT). A jointed start.ng avatar hops through Lagos markets beneath an elevated orthographic camera. Danfos, kekes and okadas travel across the road with lighting and ground shadows. Collect suya and avoid the Eyo procession.

## Run locally

Open `index.html` directly for a local playtest, or serve the folder with any static server. The game stays playable as a guest when start.ng is unavailable.

## Controls

- Arrow keys or WASD: hop forward, backward, left or right
- Mouse: click a ground location to hop toward it
- Touch: swipe in any direction or use the four-direction controls
- `P`: pause/resume
- Touch controls are included for mobile play

## Lagos route

Every 20 forward hops (250 scored metres) unlocks a new market. The route runs through Balogun, Mushin, Yaba, Tejuosho, Oyingbo, Oshodi, Mile 12, Computer Village, Ladipo, Alaba International, Idumota, Jankara, Epe Fish Market, Ajah, Ikotun, Igando, Lekki, Agbalata, and Sangotedo. Traffic gets faster and denser. Backtracking never inflates the score. Streets are generated ahead and pruned behind the player.

## start.ng integration

The game uses the start.ng connect page to load the current player or shared guest identity. Body, clothing colours, hair, hat and accessory map onto the 3D avatar. It retains the `distance` and `lanterns` score keys for existing leaderboard compatibility; `lanterns` is displayed as suya. Geometry is built in code, with the 3D street-crossing presentation and movement inspired by Gidi Hop.

## Verify

Run `node tests/game.test.mjs` for movement, collection, collision, pause, stage progression, and endless-world checks. Serve the folder over HTTP for WebGL browser playtesting. No build step or CDN dependency is required for the engine.
