/**
 * Starter pages for the Profile HTML editor. Each one uses template tags and
 * <bublr-*> widgets, so it shows the writer's own name, posts and guest book
 * the moment it's picked.
 */

const classic = {
  id: 'classic',
  name: 'Classic',
  description: 'Your Bublr profile, rebuilt in HTML so you can change anything.',
  mode: 'page',
  html: `<main class="profile">
  <bublr-avatar size="56"></bublr-avatar>
  <h1>{{displayName}}</h1>
  {{#about}}<p class="bio">{{about}}</p>{{/about}}
  <bublr-socials></bublr-socials>

  {{#hasSkills}}
  <section>
    <h2>What I work with</h2>
    <bublr-skills></bublr-skills>
  </section>
  {{/hasSkills}}

  <section>
    <h2>Writing</h2>
    <bublr-posts limit="10"></bublr-posts>
  </section>

  {{#hasGuestbook}}
  <section>
    <h2>Guest book</h2>
    <bublr-guestbook limit="6"></bublr-guestbook>
  </section>
  {{/hasGuestbook}}

  <footer>© {{year}} {{displayName}} · <a href="?classic=1">Classic view</a></footer>
</main>`,
  css: `.profile {
  max-width: 550px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}

h1 {
  font-size: 1.25rem;
  font-weight: 500;
  margin: 28px 0 8px;
}

.bio {
  color: var(--bublr-muted);
  margin: 0 0 16px;
}

section {
  border-top: 1px solid var(--bublr-border);
  margin-top: 28px;
  padding-top: 28px;
}

h2 {
  font-size: 1em;
  font-weight: 500;
  margin: 0 0 16px;
}

footer {
  margin-top: 64px;
  font-size: 12px;
  color: var(--bublr-muted);
}`,
  js: '',
}

const space = {
  id: 'space-06',
  name: 'Space ’06',
  description: 'Blue boxes, a Top 8, a profile song and a hit counter. Remember 2006?',
  mode: 'page',
  html: `<div class="page">
  <header class="masthead">
    <span class="logo">bublr<span>.space</span></span>
    <nav><a href="/explore">Browse</a> <a href="?classic=1">Classic</a></nav>
  </header>

  <div class="columns">
    <aside class="left">
      <h1 class="name">{{displayName}}</h1>
      <div class="card">
        <bublr-avatar size="160" shape="square"></bublr-avatar>
        <div class="card-text">
          <p class="quote">"{{about}}"</p>
          <p class="meta">@{{name}}<br>{{postCount}} posts<br>{{followerCount}} friends</p>
          <p class="online"><span class="blink">●</span> Online now!</p>
        </div>
      </div>

      <div class="box">
        <h2>Contacting {{displayName}}</h2>
        <div class="contact">
          <a href="?classic=1">＋ Follow</a>
          <a href="?classic=1">✉ Subscribe</a>
          <a href="?classic=1">★ Sign guest book</a>
          <a href="{{profileUrl}}">⇪ Share profile</a>
        </div>
      </div>

      <div class="box">
        <h2>{{displayName}}’s Interests</h2>
        <table>
          <tr><th>General</th><td>{{skills}}{{^skills}}writing, the internet{{/skills}}</td></tr>
          <tr><th>Elsewhere</th><td>{{#socials}}<a href="{{url}}">{{label}}</a> {{/socials}}{{^socials}}just here{{/socials}}</td></tr>
        </table>
      </div>

      <!-- Your profile song: put a link to an .mp3 in src -->
      <bublr-music src="" title="My profile song"></bublr-music>
    </aside>

    <main class="right">
      <div class="network">{{displayName}} is in your extended network</div>

      <div class="box">
        <h2>{{displayName}}’s Latest Blog Entries</h2>
        <bublr-posts limit="5" excerpt="false"></bublr-posts>
        <p class="more"><a href="?classic=1">[View all blog entries]</a></p>
      </div>

      <div class="box">
        <h2>{{displayName}}’s Blurbs</h2>
        <h3>About me:</h3>
        <p>{{about}}{{^about}}Still writing this part.{{/about}}</p>
        <h3>Who I’d like to meet:</h3>
        <p>Anyone who reads all the way to the end.</p>
      </div>

      <div class="box">
        <h2>{{displayName}}’s Friend Space</h2>
        <p class="friends-count"><strong>{{displayName}}</strong> has <span class="red">{{followerCount}}</span> friends.</p>
        <!-- Your Top 8: Bublr usernames, separated by commas -->
        <bublr-friends users=""></bublr-friends>
      </div>

      <div class="box">
        <h2>{{displayName}}’s Friends Comments</h2>
        <bublr-guestbook limit="6" empty="No comments yet. Be the first to sign!"></bublr-guestbook>
      </div>

      <p class="counter">Reads so far: <bublr-counter digits="6" label=""></bublr-counter></p>
    </main>
  </div>
</div>`,
  css: `body {
  margin: 0;
  background: #e5e5e5 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="%23dfe6ef"/><rect width="4" height="4" fill="%23e9eef5"/></svg>');
  font: 12px/1.45 Verdana, Arial, sans-serif;
  color: #000;
}

[data-theme=dark] body {
  background: #0b1020;
  color: #dbe4ff;
}

.page {
  max-width: 820px;
  margin: 0 auto;
  background: #fff;
  min-height: 100vh;
}

[data-theme=dark] .page { background: #121a33; }

.masthead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: linear-gradient(#3b5998, #2d4373);
  color: #fff;
}

.logo { font: bold 22px/1 Arial, sans-serif; letter-spacing: -1px; }
.logo span { color: #b5c7ff; font-weight: normal; }
.masthead a { color: #fff; margin-left: 12px; font-size: 11px; }

.columns {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
  padding: 14px;
}

@media (max-width: 700px) {
  .columns { grid-template-columns: 1fr; }
}

.name { font-size: 20px; margin: 0 0 8px; }

.card { display: flex; gap: 10px; }
.card-text { font-size: 11px; }
.quote { font-style: italic; margin: 0 0 8px; }
.meta { color: #555; margin: 0 0 8px; }
[data-theme=dark] .meta { color: #9fb0e0; }
.online { color: #2b9a2b; font-weight: bold; margin: 0; }
.blink { animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }

.box {
  margin-top: 12px;
  border: 1px solid #6699cc;
}

.box h2 {
  margin: 0;
  padding: 4px 8px;
  font-size: 12px;
  color: #fff;
  background: #6699cc;
}

.right .box h2 { background: #ffcc99; color: #cc5500; }
.right .box { border-color: #ffcc99; }

.box > *:not(h2) { margin: 8px; }

.contact { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.contact a { color: #003399; font-weight: bold; text-decoration: none; }
[data-theme=dark] .contact a, [data-theme=dark] a { color: #9db7ff; }

table { border-collapse: separate; border-spacing: 3px; width: calc(100% - 16px); }
th { width: 30%; background: #b1d0f0; color: #336699; text-align: left; vertical-align: top; padding: 4px; font-size: 11px; }
td { background: #d5e8fb; padding: 4px; font-size: 11px; }
[data-theme=dark] th { background: #22335f; color: #b5c7ff; }
[data-theme=dark] td { background: #1a2647; }

.network {
  border: 1px solid #000;
  padding: 10px;
  font-size: 15px;
  font-weight: bold;
  text-align: center;
}
[data-theme=dark] .network { border-color: #9db7ff; }

h3 { font-size: 11px; color: #cc5500; margin: 10px 8px 2px; }
.more { text-align: right; font-size: 11px; }
.red { color: #cc0000; font-weight: bold; }
.bublr-friends { grid-template-columns: repeat(4, 1fr); }
.bublr-friend__name { color: #003399; font-size: 11px; }
[data-theme=dark] .bublr-friend__name { color: #9db7ff; }
.bublr-music { margin-top: 12px; border-radius: 0; border-color: #6699cc; }
.counter { text-align: center; font-size: 11px; color: #555; margin-top: 18px; }`,
  js: '',
}

const terminal = {
  id: 'terminal',
  name: 'Terminal',
  description: 'Green on black, a blinking cursor and your posts as ls output.',
  mode: 'page',
  html: `<main class="term" aria-label="{{displayName}}’s terminal">
  <p class="line"><span class="prompt">{{name}}@bublr:~$</span> <span id="typed" data-text="whoami"></span><span class="cursor">▋</span></p>
  <section class="out" hidden>
    <p class="hi">{{displayName}}</p>
    <p>{{about}}</p>

    <p class="line"><span class="prompt">{{name}}@bublr:~$</span> ls -lt posts/</p>
    <bublr-posts limit="12" excerpt="false" empty="">
      <p class="ls">-rw-r--r--  {{reads}} reads  {{date}}  <a href="{{url}}">{{title}}</a></p>
    </bublr-posts>
    {{^posts}}<p class="dim">total 0</p>{{/posts}}

    <p class="line"><span class="prompt">{{name}}@bublr:~$</span> cat links.txt</p>
    {{#socials}}<p><a href="{{url}}">{{label}}</a> → {{handle}}</p>{{/socials}}

    <p class="line"><span class="prompt">{{name}}@bublr:~$</span> <span class="cursor">▋</span></p>
  </section>
</main>`,
  css: `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap');

html, body {
  margin: 0;
  min-height: 100%;
  background: #0b0f0b;
}

.term {
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 22px 80px;
  font: 14px/1.7 'IBM Plex Mono', ui-monospace, monospace;
  color: #7CFC9a;
  text-shadow: 0 0 6px rgba(124, 252, 154, 0.35);
}

html[data-theme=light], [data-theme=light] body { background: #f4f1e8; }
[data-theme=light] .term { color: #1d5c2e; text-shadow: none; }

p { margin: 0; }
a { color: inherit; }
.prompt { color: #4fc3f7; }
[data-theme=light] .prompt { color: #1565c0; }
.hi { font-weight: 600; font-size: 1.3em; margin-top: 8px; }
.line { margin-top: 18px; }
.dim { opacity: 0.6; }
.ls { white-space: pre-wrap; }
.cursor { animation: blink 1s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .cursor { animation: none; }
}`,
  js: `// Types the first command, then shows everything else
const typed = document.getElementById('typed')
const out = document.querySelector('.out')
const text = typed.dataset.text
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
let i = 0

function step() {
  typed.textContent = text.slice(0, ++i)
  if (i < text.length) setTimeout(step, 90)
  else setTimeout(() => {
    typed.nextElementSibling.remove()
    out.hidden = false
  }, 300)
}

if (reduce) {
  typed.textContent = text
  typed.nextElementSibling.remove()
  out.hidden = false
} else {
  setTimeout(step, 400)
}`,
}

const zine = {
  id: 'zine',
  name: 'Zine',
  description: 'Cut-paper collage: taped notes, tilted cards and a photocopy feel.',
  mode: 'page',
  html: `<main class="zine">
  <header class="cover">
    <p class="issue">ISSUE #{{postCount}} · {{year}}</p>
    <h1>{{displayName}}</h1>
    <p class="tag">a zine by @{{name}}</p>
  </header>

  <div class="board">
    <figure class="photo tape"><bublr-avatar size="200" shape="square"></bublr-avatar><figcaption>me, probably</figcaption></figure>
    {{#about}}<p class="note yellow">{{about}}</p>{{/about}}
    <bublr-posts limit="6">
      <article class="clip"><span class="date">{{date}}</span><a href="{{url}}"><h2>{{title}}</h2></a><p>{{excerpt}}</p></article>
    </bublr-posts>
    {{#hasSkills}}<div class="note pink"><strong>Things I like</strong><br>{{#skills}}✶ {{.}}<br>{{/skills}}</div>{{/hasSkills}}
    {{#hasSocials}}<div class="note blue"><strong>Find me</strong><br>{{#socials}}<a href="{{url}}">{{label}}</a><br>{{/socials}}</div>{{/hasSocials}}
  </div>
</main>`,
  css: `@import url('https://fonts.googleapis.com/css2?family=Special+Elite&family=Permanent+Marker&display=swap');

body {
  margin: 0;
  background: #f3efe6;
  color: #1b1b1b;
  font: 15px/1.5 'Special Elite', 'Courier New', monospace;
}

[data-theme=dark] body { background: #1d1b18; color: #ece6da; }

.zine { max-width: 980px; margin: 0 auto; padding: 32px 20px 80px; }

.cover { text-align: center; padding: 20px 0 30px; }
.cover h1 {
  font: 64px/1 'Permanent Marker', cursive;
  margin: 8px 0;
  transform: rotate(-2deg);
}
.issue, .tag { letter-spacing: 0.2em; font-size: 12px; text-transform: uppercase; margin: 0; }

.board { columns: 3 260px; column-gap: 22px; }
.board > *, .clip { break-inside: avoid; margin: 0 0 22px; display: block; }

.photo { background: #fff; padding: 10px 10px 4px; box-shadow: 2px 3px 10px rgba(0,0,0,.18); transform: rotate(2deg); }
.photo img { width: 100%; height: auto; filter: grayscale(1) contrast(1.2); }
.photo figcaption { font-family: 'Permanent Marker', cursive; text-align: center; color: #333; }

.tape { position: relative; }
.tape::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 50%;
  width: 90px;
  height: 22px;
  transform: translateX(-50%) rotate(-3deg);
  background: rgba(255, 230, 150, 0.7);
}

.note { padding: 16px; box-shadow: 2px 3px 8px rgba(0,0,0,.15); color: #1b1b1b; }
.note a { color: inherit; }
.yellow { background: #fff3a8; transform: rotate(-1.5deg); }
.pink { background: #ffd1dc; transform: rotate(1deg); }
.blue { background: #cfe8ff; transform: rotate(-1deg); }

.clip {
  background: #fff;
  color: #1b1b1b;
  padding: 16px;
  border: 1px solid #ddd;
  box-shadow: 1px 2px 6px rgba(0,0,0,.12);
}
.clip:nth-child(odd) { transform: rotate(-1deg); }
.clip:nth-child(even) { transform: rotate(1.2deg); }
.clip a { color: inherit; text-decoration: none; }
.clip h2 { font: 22px/1.15 'Permanent Marker', cursive; margin: 4px 0 8px; }
.clip p { margin: 0; font-size: 13px; }
.date { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #777; }`,
  js: '',
}

const neon = {
  id: 'neon',
  name: 'Neon',
  description: 'A synthwave sunset with a moving grid and glowing type.',
  mode: 'page',
  html: `<main class="neon">
  <div class="sky" aria-hidden="true"><div class="sun"></div><div class="grid"></div></div>
  <section class="hero">
    <bublr-avatar size="110"></bublr-avatar>
    <h1 data-text="{{displayName}}">{{displayName}}</h1>
    <p class="about">{{about}}</p>
    <bublr-socials></bublr-socials>
  </section>
  <section class="panel">
    <h2>// transmissions</h2>
    <bublr-posts limit="8" layout="cards"></bublr-posts>
  </section>
  <section class="panel">
    <h2>// stats</h2>
    <bublr-stats></bublr-stats>
  </section>
</main>`,
  css: `@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;800&family=Rajdhani:wght@400;600&display=swap');

body {
  margin: 0;
  background: #0d0221;
  color: #f6e9ff;
  font: 16px/1.5 Rajdhani, sans-serif;
}

.neon { position: relative; min-height: 100vh; overflow: hidden; }

.sky { position: fixed; inset: 0; background: linear-gradient(#0d0221 0%, #2a0a4a 45%, #ff2a6d 75%, #0d0221 75%); z-index: 0; }
.sun {
  position: absolute; left: 50%; top: 32%; width: 340px; height: 340px; transform: translateX(-50%);
  border-radius: 50%;
  background: repeating-linear-gradient(#ffd319 0 18px, transparent 18px 26px), linear-gradient(#ffd319, #ff2a6d);
  -webkit-mask: linear-gradient(#000 55%, transparent 55%, transparent 58%, #000 58%, #000 66%, transparent 66%, transparent 70%, #000 70%);
  mask: linear-gradient(#000 55%, transparent 55%, transparent 58%, #000 58%, #000 66%, transparent 66%, transparent 70%, #000 70%);
  filter: drop-shadow(0 0 40px #ff2a6d);
}
.grid {
  position: absolute; left: -50%; right: -50%; bottom: 0; height: 25%;
  background-image: linear-gradient(#05d9e8 1px, transparent 1px), linear-gradient(90deg, #05d9e8 1px, transparent 1px);
  background-size: 60px 60px;
  transform: perspective(300px) rotateX(60deg);
  transform-origin: top;
  animation: drive 1.2s linear infinite;
  opacity: .6;
}
@keyframes drive { to { background-position: 0 60px; } }
@media (prefers-reduced-motion: reduce) { .grid { animation: none; } }

.hero, .panel { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; padding: 0 22px; }
.hero { padding-top: 60px; text-align: center; }
.hero .bublr-avatar { border: 3px solid #05d9e8; box-shadow: 0 0 24px #05d9e8; }
h1 {
  font: 800 clamp(36px, 8vw, 72px)/1 Orbitron, sans-serif;
  margin: 18px 0 10px;
  color: #fff;
  text-shadow: 0 0 8px #ff2a6d, 0 0 24px #ff2a6d, 0 0 48px #d300c5;
}
.about { max-width: 520px; margin: 0 auto 14px; color: #ffd6f5; }
.bublr-socials { justify-content: center; }
.bublr-social { color: #05d9e8; }

.panel { margin-top: 48px; padding-bottom: 20px; }
.panel h2 { font: 500 14px Orbitron, sans-serif; letter-spacing: .2em; color: #05d9e8; }
.bublr-post { background: rgba(13, 2, 33, .75); border-color: #ff2a6d; box-shadow: 0 0 14px rgba(255, 42, 109, .35); }
.bublr-post__excerpt, .bublr-post__date { color: #e0b3ff; }
.bublr-stats dd { font-family: Orbitron, sans-serif; color: #ffd319; }
.bublr-stats dt { color: #ffd6f5; }`,
  js: '',
}

const brutalist = {
  id: 'brutalist',
  name: 'Brutalist',
  description: 'Huge type, hard borders, no apologies.',
  mode: 'page',
  html: `<main class="b">
  <h1>{{displayName}}</h1>
  <div class="row">
    <p class="about">{{about}}{{^about}}WRITER.{{/about}}</p>
    <dl class="facts">
      <dt>POSTS</dt><dd>{{postCount}}</dd>
      <dt>READS</dt><dd>{{totalReads}}</dd>
      <dt>SINCE</dt><dd>@{{name}}</dd>
    </dl>
  </div>
  <ol class="list">
    <bublr-posts limit="20" excerpt="false">
      <li><a href="{{url}}"><span class="n">{{index}}</span><span class="t">{{title}}</span><span class="d">{{date}}</span></a></li>
    </bublr-posts>
  </ol>
  <footer>{{#socials}}<a href="{{url}}">{{label}}</a>{{/socials}}</footer>
</main>`,
  css: `@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@400;600&display=swap');

body { margin: 0; background: #fff; color: #000; font: 16px/1.4 'Space Grotesk', sans-serif; }
[data-theme=dark] body { background: #000; color: #fff; }
[data-theme=dark] .b, [data-theme=dark] .list a, [data-theme=dark] .row > * { border-color: #fff; }

.b { border: 4px solid currentColor; margin: 12px; }
h1 {
  font: clamp(48px, 13vw, 160px)/0.85 'Archivo Black', sans-serif;
  text-transform: uppercase;
  margin: 0;
  padding: 18px;
  border-bottom: 4px solid currentColor;
  word-break: break-word;
}
.row { display: grid; grid-template-columns: 2fr 1fr; border-bottom: 4px solid currentColor; }
.row > * { padding: 18px; margin: 0; }
.about { font-size: 22px; border-right: 4px solid currentColor; }
.facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; align-content: start; }
.facts dt { font-weight: 600; }
.facts dd { margin: 0; }
@media (max-width: 640px) { .row { grid-template-columns: 1fr; } .about { border-right: 0; border-bottom: 4px solid currentColor; } }

.list { list-style: none; margin: 0; padding: 0; }
.list a {
  display: grid;
  grid-template-columns: 70px 1fr auto;
  gap: 14px;
  align-items: baseline;
  padding: 14px 18px;
  border-bottom: 4px solid currentColor;
  color: inherit;
  text-decoration: none;
}
.list a:hover { background: #ff0; color: #000; }
.n { font: 28px 'Archivo Black', sans-serif; }
.t { font-size: 22px; font-weight: 600; }
.d { font-size: 13px; }
footer { display: flex; flex-wrap: wrap; gap: 18px; padding: 18px; font-weight: 600; text-transform: uppercase; }
footer a { color: inherit; }`,
  js: '',
}

const nowPlaying = {
  id: 'now-playing',
  name: 'Now playing',
  description: 'A small music card for your profile song.',
  mode: 'block',
  html: `<div class="np">
  <div class="disc" aria-hidden="true"></div>
  <div>
    <p class="label">Now playing on {{displayName}}’s page</p>
    <!-- Put a link to an .mp3 in src -->
    <bublr-music src="" title="Song title — Artist"></bublr-music>
  </div>
</div>`,
  css: `.np { display: flex; gap: 16px; align-items: center; }
.disc {
  flex: none;
  width: 64px; height: 64px; border-radius: 50%;
  background: radial-gradient(circle, var(--bublr-bg) 0 9px, #222 10px 22px, #444 23px 24px, #222 25px);
  animation: spin 4s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .disc { animation: none; } }
.label { margin: 0 0 6px; font-weight: 500; }
.np > div:last-child { flex: 1; min-width: 0; }
.bublr-music { padding: 0; border: 0; background: none; }`,
  js: '',
}

const spotlight = {
  id: 'spotlight',
  name: 'Latest post spotlight',
  description: 'Your newest post as a big card.',
  mode: 'block',
  html: `<bublr-latest-post label="Fresh off the press">
  <a class="spot" href="{{url}}">
    <span class="kicker">Fresh off the press · {{date}}</span>
    <span class="title">{{title}}</span>
    <span class="excerpt">{{excerpt}}</span>
    <span class="cta">Read it →</span>
  </a>
</bublr-latest-post>`,
  css: `.spot {
  display: block;
  padding: 20px;
  border-radius: 14px;
  text-decoration: none;
  color: var(--bublr-text);
  background: linear-gradient(135deg, rgba(77,150,255,.12), rgba(207,82,242,.12));
  border: 1px solid var(--bublr-border);
}
.spot:hover { border-color: var(--bublr-accent); }
.kicker { display: block; font-size: 12px; color: var(--bublr-muted); text-transform: uppercase; letter-spacing: .08em; }
.title { display: block; margin-top: 6px; font-size: 20px; font-weight: 600; line-height: 1.25; }
.excerpt { display: block; margin-top: 6px; color: var(--bublr-muted); }
.cta { display: inline-block; margin-top: 10px; font-weight: 500; color: var(--bublr-accent); }`,
  js: '',
}

const blank = {
  id: 'blank',
  name: 'Start from scratch',
  description: 'An empty page. Your code, your rules.',
  mode: 'page',
  html: `<h1>Hi, I’m {{displayName}}</h1>
<p>{{about}}</p>
<bublr-posts></bublr-posts>`,
  css: '',
  js: '',
}

export const PROFILE_CODE_TEMPLATES = [classic, space, terminal, zine, neon, brutalist, nowPlaying, spotlight, blank]

export function getTemplate(id) {
  return PROFILE_CODE_TEMPLATES.find(t => t.id === id) || null
}
