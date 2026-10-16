# Lagos Market Run

A real 3D market runner made for [start.ng](https://start.ng/games), using a locally included Three.js r180 (MIT). A jointed start.ng avatar runs continuously down a market aisle. Dodge traders stepping out of their shops, stock trolleys and Eyo masquerades, collect suya and explore 19 Lagos markets. A service road and passing traffic run alongside the shops.

## Run locally

Serve the folder with `python3 -m http.server 4173` and open `http://localhost:4173`. The 3D engine uses ES modules, so open the HTTP preview instead of a `file://` page. The game stays playable as a guest when start.ng is unavailable.

## Controls

- The runner moves forward automatically, with a continuous running gait
- Left/right arrows or A/D: dodge between the three lanes
- Mouse: move across the playfield or click a lane to steer
- Touch: swipe sideways or tap the left/right buttons
- `P`: pause/resume
- Touch controls are included for mobile play

## Lagos route

Every 250 metres unlocks a new market. The route runs through Balogun, Mushin, Yaba, Tejuosho, Oyingbo, Oshodi, Mile 12, Computer Village, Ladipo, Alaba International, Idumota, Jankara, Epe Fish Market, Ajah, Ikotun, Igando, Lekki, Agbalata, and Sangotedo. Running speed and obstacle density increase. Segments are generated ahead and pruned behind the player, with at least one unblocked lane per obstacle group.

Market inventory changes in the 3D scene: Balogun has patterned clothing racks, shoes and handbags; Mushin has food sellers; Mile 12 has tomatoes, peppers, onions and yam; Computer Village has phones and laptops; Ladipo has tyres and motor parts; Epe has fish; Lekki has art, baskets and beads. Traders hold merchandise and step into the aisle after a visible warning. Adjacent traffic never crosses the runner's path.

References used for the market themes: [Lagos wholesale market specialities](https://towobo.com/pt/suppliers/wholesale-suppliers-in-lagos), [Mushin, Oyingbo and Mile 12 food markets](https://24hoursmarket.com/cheapest-markets-in-lagos-for-food-2026-guide/), and the [Tejuosho market directory](https://portal.tejuoshoshoppingcomplex.com/market-info). Stalls and trader names are fictional game scenery.

## Sound and music

`market-audio.js` synthesizes an original highlife/Afrobeat-inspired loop with percussion, syncopated bass, plucked melody and chords, plus market ambience, distant horns, grounded footsteps, trader warning cues, collection sounds and collision effects. It starts after a user gesture. Music and effects have independent volume controls, a preview button, master mute and saved preferences. Pausing or hiding the game stops the music scheduler; resuming never creates duplicate loops. No third-party music recordings are used.

## start.ng integration

The game uses the start.ng connect page to load the current player or shared guest identity. Body, clothing colours, hair, hat and accessory map onto the 3D avatar. It retains the `distance` and `lanterns` score keys for existing leaderboard compatibility; `lanterns` is displayed as suya. Geometry and market goods are built in code.

## Verify

Run `node tests/game.test.mjs` for automatic running, grounded animation, dodging, collection, collision, pause, market inventory, stage progression and bounded-world checks. Run `node tests/audio.test.mjs` for music scheduling, effects, mixing, mute and pause/resume checks. Serve the folder over HTTP for WebGL browser playtesting. No build step or CDN dependency is required for the engine.
