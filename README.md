# Lagos Market Run

A real 3D market runner made for [start.ng](https://start.ng/games), using a locally included Three.js r180 (MIT). A jointed start.ng avatar runs continuously down a market aisle. Dodge traders stepping out of their shops, stock trolleys and Eyo masquerades, collect suya and scarce cash, buy pure water from a shouting hawker and throw it at a chasing Eyo. A service road, road crossings and passing traffic make the route increasingly dangerous.

> Enjoying the Lagos run? Please give the project a ⭐ on [GitHub](https://github.com/michycipher/lagos-market-run). Your star helps people discover the game and keeps the market energy moving!

## Run locally

Serve the folder with `python3 -m http.server 4173` and open `http://localhost:4173`. The 3D engine uses ES modules, so open the HTTP preview instead of a `file://` page. The game stays playable as a guest when start.ng is unavailable.

## Controls

- The runner moves forward automatically, with a continuous running gait
- Left/right arrows or A/D: dodge between the three lanes
- Mouse: move across the playfield or click a lane to steer
- Touch: swipe sideways or tap the left/right buttons
- `P`: pause/resume
- `↑` or `W`: fire pure water at a chasing Eyo
- `5`, `Space` or `E`: enter a nearby shop, buy the displayed market item into a nylon shopping bag, board a danfo, buy a ₦20 pure-water sachet, or interact with the nearest market moment
- Danfo stops: choose a later market, pay the displayed fare, ride inside the bus with passengers and listen for the conductor's call before being dropped at your destination
- Touch controls are included for mobile play

## Lagos route

Every 250 metres unlocks a new market. The route runs through Balogun, Mushin, Yaba, Tejuosho, Oyingbo, Oshodi, Mile 12, Computer Village, Ladipo, Alaba International, Idumota, Jankara, Epe Fish Market, Ajah, Ikotun, Igando, Lekki, Agbalata, and Sangotedo. Running speed and obstacle density increase. Segments are generated ahead and pruned behind the player, with at least one unblocked lane per obstacle group.

Market inventory changes in the 3D scene: Balogun has patterned clothing racks, shoes and handbags; Mushin has food sellers; Mile 12 has tomatoes, peppers, onions and yam; Computer Village has phones and laptops; Ladipo has tyres and motor parts; Epe has fish; Lekki has art, baskets and beads. Tejuosho becomes a multi-storey mall frontage with an outside market, road-side sellers and a Yaba footbridge. Traders hold merchandise, wave, shout and step into a fixed lane after a visible warning. Agberos are physical lane obstacles. Cash drops are rare, pure-water hawkers are friendly, water costs ₦20, Eyo chases the runner, and road-crossing traffic can end a run.

References used for the market themes: [Lagos wholesale market specialities](https://towobo.com/pt/suppliers/wholesale-suppliers-in-lagos), [Mushin, Oyingbo and Mile 12 food markets](https://24hoursmarket.com/cheapest-markets-in-lagos-for-food-2026-guide/), and the [Tejuosho market directory](https://portal.tejuoshoshoppingcomplex.com/market-info). Stalls and trader names are fictional game scenery.

## Sound and music

`market-audio.js` synthesizes an original highlife/Afrobeat-inspired loop with percussion, syncopated bass, plucked melody and chords, plus market ambience, distant horns, grounded footsteps, trader warning cues, natural-paced browser voice callouts with Nigerian English preference, money/purchase/water sounds and collision effects. It starts after a user gesture. Music and effects have independent volume controls, a preview button, master mute and saved preferences. Pausing or hiding the game stops the music scheduler; resuming never creates duplicate loops. No third-party music recordings are used.

The perspective camera follows the runner like a handheld market recording. Side stalls have entrances: steer toward a shop, wait for its prompt and press `5`/`E` (or the mobile action button) to step into the shop, buy the featured goods and see the purchase added to the avatar's nylon bags. Danfo stops open a destination panel, then move the camera inside a bus with passengers and a conductor before placing the runner at the selected market.

The current callouts use the browser's speech-synthesis fallback, with Nigerian English preference where the device exposes it. start.ng's documented backend supplies identity, style and score/leaderboard integration, not human voice recordings or a voice API; replacing the fallback with a truly natural Nigerian performance requires recorded voice assets.

## start.ng integration

The game uses the start.ng connect page to load the current player or shared guest identity. Body, clothing colours, hair, hat and accessory map onto the 3D avatar. It retains the `distance` and `lanterns` score keys for existing leaderboard compatibility; `lanterns` is displayed as suya. Geometry and market goods are built in code.

## Verify

Run `node tests/game.test.mjs` for automatic running, grounded animation, dodging, collection, collision, pause, market inventory, Tejuosho mall/footbridge generation, scarce-money water purchases, Eyo fleeing and bounded-world checks. Run `node tests/audio.test.mjs` for music scheduling, effects, mixing, mute and pause/resume checks. Serve the folder over HTTP for WebGL browser playtesting. No build step or CDN dependency is required for the engine.

## Support the run

If Lagos Market Run made you smile, made you shout “oya!”, or gave you a new high score, please [leave the repository a star on GitHub](https://github.com/michycipher/lagos-market-run). It is a small gesture that helps the project reach more players and supports future market updates.
