# Lagos Market Dash

A dependency-free lane runner made for [start.ng](https://start.ng/games). Move the start.ng character through a lively Lagos night market, collect pepper-dusted suya skewers, dodge danfos, Eyo masquerades, and handcarts, and push the farthest distance to the shared leaderboard.

## Run locally

Open `index.html` directly for a local playtest, or serve the folder with any static server. The game stays playable as a guest when start.ng is unavailable.

## Controls

- `A` / `D` or the arrow keys: switch lanes
- Mouse movement or clicks across the road: steer into a lane
- `P`: pause/resume
- Touch controls are included for mobile play

## Lagos route

Every 250m is a new market stage. The route runs through Balogun, Mushin, Yaba, Tejuosho, Oyingbo, Oshodi, Mile 12, Computer Village, Ladipo, Alaba International, Idumota, Jankara, Epe Fish Market, Ajah, Ikotun, Igando, Lekki, Agbalata, and Sangotedo. The road accelerates and traffic arrives more frequently at each stop.

## start.ng integration

The game uses the start.ng connect page to load the current player or shared guest identity and renders their style as the in-game runner. It saves `distance` and `lanterns` with `startng.json` through the connect page and reads the public leaderboard through the HTTP API. The road is styled as a Nigerian market route with Mama Put and suya stalls, grounded danfo traffic, Eyo masquerades, warm market lighting, and Lagos night colors.
