# Neon Market Dash

A dependency-free lane runner made for [start.ng](https://start.ng/games). Move the start.ng character through a neon market, collect lanterns, avoid barricades, and push the farthest distance to the shared leaderboard.

## Run locally

Open `index.html` directly for a local playtest, or serve the folder with any static server. The game stays playable as a guest when start.ng is unavailable.

## Controls

- `A` / `D` or the arrow keys: switch lanes
- `P`: pause/resume
- Touch controls are included for mobile play

## start.ng integration

The game uses the start.ng connect page to load the current player or shared guest identity and renders their style as the in-game runner. It saves `distance` and `lanterns` with `startng.json` through the connect page and reads the public leaderboard through the HTTP API.
