# 1984 — engine architecture and module contract

Read this before touching any module. Every module is an ES module under `src/`, bundled by esbuild (`node tools/build.mjs`) into `game.js`. three.js r186 is imported as `import * as THREE from 'three'` (addons from `three/examples/jsm/...`). No other runtime dependencies. All visible text is Korean, except things that exist inside Oceania (posters, slogans, telescreen captions, newspaper slips), which stay in English as in the novel.

The source novel text is at `/tmp/claude-0/-home-user--/0ab14487-ba40-59f7-80fa-2794cb380d3c/scratchpad/src/1984.txt` (Part One starts at line 1, Part Two at 3330, Part Three at 7311). Use it for setting details and short quotes. Translate dialogue into natural Korean yourself; keep quotes short (a sentence or two).

## Visual target

As realistic as possible. Grimy, cold, desaturated London of 1984 rendered with PBR. Never cartoonish: no saturated primary colours (except Party posters and Julia's scarlet sash), no outlines, no bouncy animation. Scale is real metres. Light is physically plausible (three.js physically correct lights: point light intensity in candela, e.g. a 60 W bulb ≈ 60–80 cd with `decay = 2`; directional sun ≈ 3).

## Coordinates

Y is up, metres. North is −Z, south +Z, east +X, west −X. Blender assets face +Z in three.js (their front) and stand on y = 0 at their origin. A rotation `rotY` of π faces −Z (north), +π/2 faces +X (east), −π/2 faces −X (west).

The city occupies roughly x ∈ [−360, 360], z ∈ [−300, 320]. The countryside is a separate location centred at (3000, 0, 0). Interiors are separate locations at x ≥ 6000, each in its own 100 m slot (`x = 6000 + 100 * slot`), all on y = 0. Locations never overlap, so one collider set serves them all.

## The game context `G` (src/game/game.js)

`createGame()` builds `G`. Modules export a factory `export function setupX(G)` that receives `G`, builds what it needs, attaches its API to `G` (e.g. `G.world = ...`), and returns it. They must not import each other directly; they talk through `G`.

Fields and helpers already implemented:

- `G.THREE`, `G.scene`, `G.camera`, `G.renderer` (`.u` = grading uniforms: `uFade`, `uAlarm` 0..1, `uWatched` 0..1, `uSat`, `uVignette`, `uGrain`), `G.atmos` (sky/sun/fog; `setWeather(name)` with names `clear_cold | overcast | rain | golden | hot_haze`; `.day` 0..1 daylight, `.sun` DirectionalLight, `.hemi`).
- `G.input`: `down(code)`, `hit(code)` (pressed this frame), `lock()`, `unlock()`.
- `G.player`: `pos` (feet), `yaw`, `pitch`, `place(x,y,z,yaw)`, `running`, `moving`, `crouch` 0..1, `seated` 0..1, `lookTarget` (Vector3 or null: camera eases toward it), `forward()`, `lookDir()`, `onStep(running)` callback, `fovKick`.
- `G.col`: colliders. `add(cx, cz, hx, hz, rotY, {y0, y1, tag, sight, solid})` adds an oriented box (half extents). `addBox3(box3, opts)`. `resolve(p, r)`, `blocked(ax, az, bx, bz, ay, by)` line-of-sight test, `inside(x, z, tag)`.
- `G.assets.instance(name)` → a cloned `Object3D` of a Blender model (characters cloned with SkeletonUtils), `G.assets.animations(name)` → `AnimationClip[]`, `G.assets.tex(name)`.
- Characters (`char_*`) are photo-textured Microsoft Rocketbox avatars (MIT) converted by `blender/rocketbox.py`: about 1.8 m tall, feet at y = 0, facing +Z, unit scale, 3DS Max Biped skeleton. Clips: `idle` (12 s), `walk` (1.1 s loop, in place, about 1.35 m/s), `run` (0.8 s loop, in place, about 3.5 m/s), `sit` (seated on a 0.45 m chair, hips lowered by the clip), `shout` (fists raised, cheering: use for the Two Minutes Hate), `talk` (hand gestures), `kneel` (crouching), `look` (idle looking around). There is no `hands_up` clip; pose arms procedurally if needed. Bones the game uses are renamed: `head`, `neck`, `chest`, `hips`; the rest keep Biped names (three.js strips spaces: `Bip01_L_UpperArm`, `Bip01_L_Forearm`, `Bip01_L_Hand`, `Bip01_L_Thigh`, `Bip01_L_Calf`, `Bip01_L_Foot`, ...). Materials are textured (`rb_<role>_body`, `rb_<role>_head`); `G.mats.apply` leaves them alone except `sash_red`. Roles: `party_man`, `party_man_b`, `winston`, `syme`, `parsons`, `party_woman`, `julia`, `obrien`, `thought_police`, `guard`, `prole_man`, `prole_woman`, `charrington`, `child`.
- `G.mats.apply(root, {cast, receive, override})` swaps Blender placeholder materials for the PBR library (photoscanned CC0 textures); call it on every instanced model. `G.mats.get(name)`; ground materials with world-space UVs: `asphalt`, `paving`, `cobble`, `dirt`, `grass` (asphalt, paving and cobble grow puddles when `uWet` rises); extra wall sets `plaster_peeling`, `brick_dark`, `rust`. `G.mats.signMaterial(text, {bg, fg, serif})` makes a sign. `G.mats.globals.uWet/uNight`.
- `G.art`: `telescreen` (shared broadcast; `.set(mode, caption)` with modes `bb | figures | music | hate | jerks | news | slogans | off`; `.hate` 0..1 progress; `.jerk` phase; `.jerkKind`), `posterBB()`, `posterIngsoc()`, `posterEurasian()`, `sign(text)`, `drawBB(ctx, x, y, s)`.
- `G.state`: `{ day, minutes, suspicion, record, flags, inventory: string[], money, location, ending, part }`.
- `G.clock`: `{ scale, paused }` — game minutes per real second (1 by default outside, 0 inside scripted work).
- `G.time` real seconds; `G.paused` (menus); `G.cutscene` counter (>0 freezes player movement and the clock); `G.modal` (UI modal open: freezes movement and look); `G.lookLocked`.
- `G.wait(sec)`, `G.until(pred, timeout)` → Promise resolved by the loop.
- `G.fade(to, dur)` → Promise (to 1 = black).
- `G.addLocation({ id, root, exterior, spawns: {name: {x, y, z, yaw}}, ground?(x,z), fogColor?, fogDensity?, exposure?, onEnter?(G), onExit?(G), update?(dt, G), zone?(x,z) })`.
- `G.enter(id, spawn)`, `G.teleport(id, spawn, {during})` (fades).
- `G.interact({ location, pos: Vector3, radius, label, enabled?(), use(G) })` → remover. The engine shows the prompt for whichever one the player looks at; E or left click uses it.
- `G.trigger({ location, x, z, r } | { location, x, z, hx, hz }, { once, enter(), exit?(), enabled?() })` → remover.
- `G.onUpdate(fn(dt))` → remover. `G.events` (`on(name, fn)`, `emit(name, data)`); built-in events: `minute`, `update`, `enter` (location id), `time`.

## Modules to implement

Each section lists the file, what it must build and the API it must expose. Keep each module self-contained and robust (no exceptions when a model is missing; log a warning instead).

### src/world/city.js — `setupCity(G)` → `G.world`

Builds the exterior location `'city'` (`exterior: true`). Uses the Blender models, instanced where repeated (`THREE.InstancedMesh` per mesh child for buildings used many times, plain clones otherwise). Every building and solid prop adds colliders (`G.col.add`, oriented boxes from the model's local bounding box, rotated). Ground: large asphalt plane plus raised pavements (0.12 m kerbs with stone kerb faces), paved squares, cobbled prole streets, bomb sites (dirt + `rubble_pile`), all with world-space UVs (`u = x / tile`, tile = 3 m asphalt, 2.4 m paving, 1.6 m cobble). Street furniture: `lamp_post` every ~22 m along pavements, `bench`, `bin`, `sandbags`, `telescreen_pole`s, posters (`poster` model with material override `poster_bb`, `poster_ingsoc`, or the Eurasian poster) on walls at eye height and large ones high on facades, wall-mounted `telescreen_wall`s at building entrances.

Layout (centres, rotY):
- Ministry of Truth `minitrue` at (0, 0, −200), rotY 0 (front +Z faces the square). Entrance door at (0, 0, −114.5). Plaza x ∈ [−60, 60], z ∈ [−114, −100], paving.
- Victory Square x ∈ [−55, 55], z ∈ [−100, −10], paving. `monument` at (0, 0, −55) (fluted column with Big Brother's statue and four lions; telescreens all round its pediment: 4 `telescreen_pole`s at radius 13). St Martin's `church` at (82, 0, −50) rotY −π/2 (portico faces the square). `party_block_c` at (−70, 0, −60) rotY π/2. Chestnut Tree `cafe` at (−66, 0, −22) rotY π/2 with a `chestnut` tree beside it. `party_block_b` at (70, 0, −20) rotY −π/2.
- Square south corners: `party_block_a` at (−38, 0, 2) rotY π and (38, 0, 2) rotY π.
- Victory Avenue: road x ∈ [−9, 9], z ∈ [−10, 260]; pavements x ∈ [−15, −9] and [9, 15]. West side (rotY π/2): `party_block_b` (−23, 0, 30), `victory_mansions` (−25, 0, 95) (Winston's block; entrance on its +X face, door at about (−17.5, 0, 95) — compute from the model), `party_block_a` (−23, 0, 150), `party_block_c` (−25, 0, 215). East side (rotY −π/2): `community_centre` (27, 0, 30), `party_block_a` (23, 0, 95), `party_block_b` (24, 0, 150), `party_block_a` (23, 0, 205).
- Mansions Road: asphalt z ∈ [54, 66], x ∈ [−200, 60]. More Party housing behind Victory Mansions: `party_block_c` (−75, 0, 95) rotY π/2, `party_block_a` (−75, 0, 160) rotY π/2, `party_block_b` (−120, 0, 100) rotY −π/2.
- Station Road: z ∈ [195, 207], x ∈ [−200, 15]. Paddington `station` at (−110, 0, 250) rotY π (facade faces north at z ≈ 214).
- Love Lane: z ∈ [−104, −94], x ∈ [−185, −63] (west from the square). Ministry of Love: `pyramid_far` scaled 0.8 at (−270, 0, −170) (windowless, as in the novel). Perimeter of `fence_wire` segments (6 m each) around x ∈ [−350, −185], z ∈ [−250, −85] with a gap gate at (−185, 0, −99), `guard_tower`s at the corners and gate, `mg_nest`s by the gate, a `van` parked inside.
- Inner Party quarter: road z ∈ [−95, −85], x ∈ [55, 290] continuing east from the square's north edge, lined with `chestnut`/`elm` trees. `inner_block`s at (140, 0, −130), (190, 0, −125) (O'Brien's; door at its +Z face), (240, 0, −130), rotY 0, and a second row at z = −185.
- Prole quarter x ∈ [60, 330], z ∈ [−5, 310]: narrow cobbled streets 7 m wide running east–west at z = 30, 90, 150, 210, 270 and north–south at x = 63, 130, 200, 270. Fill blocks with `prole_terrace`, `prole_terrace_b`, `prole_ruin` facing the streets, leaving alleys and bomb sites (`rubble_pile`, dirt, willow-herb sprites). Mr Charrington's `shop` (sign "CHARRINGTON — ANTIQUES") at (165, 0, 95) rotY π (faces the street at z = 90); its door ≈ (157.6, 0, 91). A `pub` (sign "THE WHITE HART") at (95, 0, 35) rotY π. One `telescreen_pole` at the quarter's edge only. Washing lines, chimney smoke, a few proles.
- Backdrop: two more `pyramid_far` (Minipax at (−900, 0, −700), Miniplenty at (850, 0, −820)), and beyond the city edges low-detail filler buildings (instanced boxes with the concrete/brick materials and window textures) out to 900 m so the fog never shows empty land.

API: `G.world = { zoneAt(x, z) → zone id, zones: {id: {name: Korean name, rects: [[x0, z0, x1, z1], ...]}}, points: {name: Vector3}, paths: {name: Vector3[]}, lamps: Vector3[], telescreens: [{pos, dir, fov, range, location}], posters: Object3D[], setPosterEnemy(kind) }`.
Zones: `square`, `avenue`, `mansions`, `minitrue`, `cafe`, `community`, `station`, `lovelane`, `miniluv`, `inner`, `prole`, `outskirts` (default). Points must include: `home_door` (outside Victory Mansions' entrance), `minitrue_door`, `monument`, `shop_door`, `pub_door`, `obrien_door`, `station_door`, `cafe_door`, `community_door`, `rocket_site` (a prole street spot for the steamer), `convoy_start`, `convoy_end` (a route along the square's south edge), `rally` (in the square). Paths: `avenue_w`, `avenue_e`, `square_loop`, `lovelane`, `prole_a`, `prole_b`, `inner` (pavement polylines for crowds and patrols). Lamps lit at night: emissive bulb plus a pooled set of up to 12 real `PointLight`s (warm sodium/tungsten, ~100 cd, distance 25, decay 2, no shadows) assigned to the lamps nearest the camera every second; turned off by day. `uNight` drives lit windows.

### src/world/interiors.js — `setupInteriors(G)` → `G.interiors`

Builds each interior as its own location (`exterior: false`) with walls, floor and ceiling meshes (library materials: `wallpaper`/`plaster`/`concrete_grey`/`tile_white`/`wood` floors), props from the Blender models, real lights (`PointLight`/`SpotLight` with shadows for the main light only), colliders, and telescreens. Rooms must feel lived in and grim: stains, a bare bulb, a window with the city beyond (a big plane showing a dim painted view or simply a bright foggy window with glass), skirting boards, doors.

Locations (id → contents → spawns):
- `flat` — Winston's flat, 7th floor of Victory Mansions: living room 5×4 m with the telescreen on the LONG wall opposite the window, and beside it a shallow alcove (1.2 m wide, 0.6 m deep) where a person sitting at a small table is outside the telescreen's field of view (this is the point of the novel's first chapter). Table with the diary drawer, chair, bed (alcove bedroom area), kitchen corner with the gin bottle, a door to the corridor. Spawns: `door`, `bed`, `alcove`. Exposes `points.alcove_seat`.
- `mansions_hall` — the ground-floor hallway: smells of boiled cabbage, rag mats, a huge Big Brother poster too large for indoor display, the lift with an OUT OF ORDER notice, stairs. Spawns `street` (inside the glass doors) and `stairs`. Using the stairs takes you to `flat` (`door`) after a fade; the glass doors lead out to the city `home_door`.
- `parsons_flat` — next door: bigger, battered, children's things, a blocked kitchen sink. Spawn `door`.
- `records` — the Records Department, Ministry of Truth: a long hall of glass-fronted cubicles, Winston's cubicle (`cubicle` model) with speakwrite, pneumatic tubes and memory hole, the big telescreen at the end of the hall with rows of chairs for the Two Minutes Hate (`chair_row`), a corridor with white light. Spawns `entrance`, `cubicle`, `hate_seat`, `corridor`. Points: `cubicle_seat`, `hate_seat`, `screen`, `julia_seat` (behind Winston), `obrien_seat` (a couple of places away).
- `canteen` — low-ceilinged, deep underground; metal tables (`canteen_table`), grille at the counter with steam, gin bar hole in the wall, telescreen. Spawns `door`, `table`.
- `shop` — Mr Charrington's junk shop: shelves of rubbish, the glass paperweight on a table, dim. Stairs to `room`. Spawns `door`, `stairs`.
- `room` — the room above the shop: big mahogany bed (`bed_old`), gateleg table, armchair, oil stove, the St Clement Danes engraving on the wall (the hidden telescreen is BEHIND it: when the story says so, the engraving falls and a `telescreen_wall` is revealed), window over the yard where a prole woman hangs washing. No visible telescreen otherwise. Spawns `door`, `bed`, `window`.
- `pub` — prole pub: bar, darts, beer in mugs, old man. Spawn `door`.
- `obrien` — O'Brien's flat in the Inner Party quarter: soft carpet, dark-blue wallpaper, a telescreen that can be switched off, writing table with lamp, servant Martin. Spawn `door`.
- `cafe` — the Chestnut Tree Café: dim, corner table with chessboard, gin, telescreen. Spawn `door`, `corner`.
- `cell` — Ministry of Love cell: high-ceilinged, windowless, white porcelain tiles, a bench round the wall, four telescreens, a bucket, glaring light with no shadows. Spawns `bench`.
- `interrogation` — the room with the `rack` and dial, O'Brien. Spawn `rack`.
- `room101` — Room 101: the `cage` on a table, a chair with straps. Spawn `chair`.
- `station_hall` — not needed (the station is reached from the city and leads to the countryside by a fade).

API: `G.interiors = { points: {locationId: {name: Vector3}}, doors: [...], setEngravingFallen(bool), telescreens: [...] }`. Doors are interactables that call `G.teleport(...)`. Every interior registers its telescreens with `G.surv.addTelescreen(...)` if `G.surv` exists at that time, otherwise appends to `G.interiors.telescreens` (the surveillance module picks them up).

### src/world/countryside.js — `setupCountryside(G)` → `G.country`

Location `'country'` (exterior) at (3000, 0, 0): a rolling terrain (heightfield, grass/dirt textures blended in a shader by slope and noise), a small railway halt with the `train`, a road heading left, "a gate with the top bar missing" (`gate`), a path across a field, a grass-grown lane, a track between bushes (`hazel`, `hedge`), "a dead tree with moss on it" (`dead_tree`), a wood with a clearing carpeted with bluebells (instanced blue flower sprites), the Golden Country beyond: an old rabbit-bitten pasture with a foot-track, molehills, a ragged hedge with elm trees swaying, a clear slow stream with willows. Dense instanced grass (wind-animated shader, alpha-tested `grass_blade` texture) near the player; billboards or texture far away. Birdsong points (a thrush on a hazel bough). Spawns `halt`, `clearing`, `golden`. API: `G.country = { points: {...}, ground(x,z) }`.

### src/game/npc.js — `setupNPCs(G)` → `G.npcs`

Skinned characters from `char_*` models with an `AnimationMixer`, crossfading clips. Head turns toward a look target. Ground snapping via the location's `ground`. Collision avoidance with the player (push apart) and colliders. Distance culling (hide beyond 120 m, freeze mixers beyond 50 m). Shadows on.

API:
- `G.npcs.spawn({ id, model: 'char_julia', location, x, z, yaw, anim = 'idle', name })` → npc with `.root`, `.pos`, `.setAnim(name, fade)`, `.walkTo(x, z, {run})` → Promise, `.followPath(Vector3[], {loop, run})`, `.stop()`, `.face(x, z)`, `.lookAt(Vector3|null)`, `.remove()`, `.visible`, `.say(text, sec)` (floating subtitle line handled by `G.ui.bubble`).
- `G.npcs.get(id)`, `G.npcs.removeAll(location?)`.
- `G.npcs.crowd(location, { models: [...], paths: [names], count, density })` → ambient walkers that loop along `G.world.paths`; `G.npcs.setCrowdDensity(location, 0..1)` (commute hours busy, evenings thin, night empty).
- Patrols: `G.npcs.patrol({ id, model: 'char_thought_police', location, path: Vector3[] })` returns an npc with `.viewCone` data used by surveillance, and `.investigate(pos)` to walk to a point.

### src/game/surveillance.js — `setupSurveillance(G)` → `G.surv`

- Telescreens: `addTelescreen({ location, pos: Vector3, dir: Vector3 (facing), fov (deg, default 150), range (m, default 12 inside / 26 outside), mic: radius })`. A telescreen sees the player if within range, inside the cone, and `!G.col.blocked(...)`. The player crouching in darkness halves the range.
- Living range: `allowed` is a Set of zone ids from `G.story.allowedZones()` (fallback: by time of day). The current zone is `G.location.zone?.(x, z)` or `G.world.zoneAt`. Interiors count as allowed unless the story says otherwise.
- Suspicion (0..100) in `G.state.suspicion`, with these rules per second: outside the living range and watched by a telescreen +6; outside and unwatched +0.6 (+0.25 in the prole quarter); seen by a patrol while outside +10; running while watched +1.5; `G.surv.flag('forbidden')` actions (reading the note, writing the diary) while watched +18 then +12/s; not shouting during the Hate +8 (set by the story via `G.surv.require('shout')`); decay −0.35/s when inside the range and unwatched, never below `G.state.record`. At day end `record = max(record, suspicion * 0.35)`.
- Feedback: `G.renderer.u.uWatched` eases to 1 while watched, `uAlarm` rises above 60. The telescreen voice barks warnings via `G.ui.telescreen(text)` with cooldown: "6079 스미스 W! …". Examples: leaving the range, running, loitering, face crime.
- Responses: at 40 patrols come more often; at 70 the nearest patrol investigates the last place the player was seen; when a patrol reaches the player with suspicion ≥ 70, or suspicion hits 100, emit `G.events.emit('arrest', reason)` (the story turns it into the vaporisation ending unless it is already part of the story).
- A police helicopter (`helicopter` model, spinning `rotor` and `tail_rotor` nodes) hovers between roofs "like a bluebottle", snooping into windows, with a searchlight (SpotLight + visible cone) at night; it also watches (narrow downward cone).
- API: `{ addTelescreen, watched (bool), watchers (count), zone, outside (bool), flag(name), require(name, on), add(amount, reason), setAllowedOverride(set|null), helicopter }`. Also show a small eye indicator via `G.ui.hud`.

### src/game/story.js and src/game/script/*.js — `setupStory(G)` → `G.story`

Runs the days of the novel as described in `docs/design.md` (read it), with free roaming between beats. Schedule per day (wake 07:15 with the whistle and the Physical Jerks; commute; work at the Ministry from 08:30 with time compressed inside; the Two Minutes Hate at 11:00; lunch; leave at 18:00; free evening until the 23:00 curfew; sleep in Winston's bed to end the day). Beats are async functions using `G.ui` and `G.npcs`. Objectives are shown with `G.ui.objective(main, optional[])`. Save after each day with `localStorage` (`G.story.save()/load()`).

API: `{ start(newGame), allowedZones() → Set, day(), save(), load(), endings: {...} }`. Listen to `G.events.on('arrest')`.

Endings (all tragic, see design.md): `loved_bb`, `vaporized`, `again`, `informer`.

### src/game/ui.js — `setupUI(G)` → `G.ui`

DOM overlay (one `#ui` root, CSS injected by the module) styled like 1984 Oceania paperwork: off-white paper, typewriter text, Ingsoc red rule lines, grey glass panels; never cute. Korean text uses the Korean serif/sans. Must work at 1280×720 and on a 375 px wide phone (touch controls are out of scope but layout must not break).

API (all promise-returning calls must resolve even if the player spams keys):
- `hud` updates every frame: clock and date ("1984년 4월 4일 화요일 07:15"), current zone name and whether it is inside the living range, suspicion meter (an eye that opens as suspicion grows), watched indicator, objective list, interaction prompt from `G.focus.label` ("E  일기를 쓴다").
- `say(speaker, text, {portrait, voice, wait})` → Promise (dialogue box at the bottom; typewriter reveal; click/E/Space to continue).
- `choice(options[], {timeout, prompt})` → Promise<index>.
- `bubble(npc, text, sec)` — floating subtitle above an NPC, attached in screen space.
- `telescreen(text)` — the telescreen voice: a harsh banner at the top with static.
- `toast(text)`, `objective(main, optional[])`, `title(big, small, sec)` (chapter cards like "1부 · 1984년 4월 4일"), `fadeText(lines[], {hold})` over black.
- `diary({ prompt, lines })` → Promise<string[]> — the diary writing scene: creamy paper, the date "April 4th, 1984." and phrases the player picks or types.
- `work(slips)` → Promise<results> — the Records Department rectification mini-game: slips like `times 17.3.84 bb speech malreported africa rectify`, the original article on the left, the player chooses the correction, then drops the original into the memory hole.
- `jerks()` → Promise<misses> — the Physical Jerks rhythm game following the instructress (ONE two three four).
- `hate()` → Promise<participation 0..1> — hold Space/E to shout along as the Hate rises.
- `fingers(rounds)` → Promise — O'Brien's "How many fingers am I holding up, Winston?" with the dial.
- `book(pages)` — reading Goldstein's book.
- `map()` — full-screen map of the city with the living range shaded for the current time.
- `pause()` menu with settings: quality (low/medium/high → `G.renderer.setup(...)` again), mouse sensitivity, volume, subtitles speed; save/load; controls help.
- `ending(id, lines)` — ending screen with the title and credits.
- `loading(progress)` and `mainMenu()` → Promise<'new'|'continue'>.

### src/core/audio.js — `setupAudio(G)` → `G.audio`

Web Audio. Use real recorded samples from `assets/audio/` when present (packed into `assets.js` as data URIs under `window.__ASSETS__.a`), otherwise synthesise plausibly. Positional sounds via `PannerNode` following `G.camera`. API: `play(name, {pos, volume, rate})`, `loop(name, {pos, volume})` → handle with `.stop()`, `.setVolume()`, `ambience(name)` crossfades the background bed (`city_day`, `city_night`, `rain`, `interior`, `country`, `cell`), `step(surface, running)`, `telescreen(on, pos)` (the fruity voice droning about pig-iron as a murmur), `music(name)` (marching band, Hate Song), `master(v)`. Unlock the context on the first click.

### src/game/weather.js — `setupWeather(G)` → `G.weather`

Rain streaks (instanced quads around the camera, falling in a vertex shader, lit by the sky), splashes and drips, puddle ripples (the asphalt/paving normal maps already contain puddles; add ripple animation via `G.mats.globals`), wetness `uWet` easing with rain, wind gusts that blow "eddies of dust and torn paper" (paper sprites tumbling near the ground), chimney smoke in the prole quarter, steam from vents, dust motes in interior light shafts. API: `{ set(name) }` that also calls `G.atmos.setWeather(name)`.

## Conventions

- Build check: `node tools/build.mjs` must succeed. Syntax check one file: `node --check file.js` will fail on `import`, so instead run `npx esbuild <file> --bundle --format=esm --outfile=/dev/null --external:three` — missing sibling modules may be stubbed.
- Do not edit files outside your module unless the task says so. If you need a small change to a shared file, describe it in your final report instead.
- Comments: brief, explain why, not what. Match the existing style in `src/core/*.js`.
