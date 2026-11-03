// Avatar card for Home Assistant Assist — a talking face (video loops) that follows the voice assistant.
// Talks through a satellite (VACA, ESPHome, Voice PE …) or through this device's own mic and speaker.
// English + Latvian UI, visual editor, avatar picker (long press). Options: see README.md.
//
// Balss palīga avatars Home Assistant Assist — runājoša seja (video cilpas), kas seko balss palīgam.
// Runā caur satelītu (VACA, ESPHome, Voice PE …) vai caur šīs ierīces mikrofonu un skaļruni.
// Angļu + latviešu valoda, vizuālais redaktors, palīga izvēle (ilgs spiediens). Iestatījumi: README.md.

const VERSION = "2.2.0";
const STATES = ["idle", "listening", "processing", "responding"];

// Avatāri pēc noklusējuma stāv tajā pašā mapē, kur šis fails (/hacsfiles/… vai /local/…).
// (no steka, nevis import.meta — tā strādā arī tad, ja resurss pievienots kā parasts JS, nevis modulis)
const SCRIPT_DIR = (() => {
  try {
    const m = new Error().stack.match(/(https?:\/\/[^\s()]*?\/)[^/\s()]*\.js/);
    if (m) return new URL(m[1]).pathname;
  } catch (e) { /* nav steka */ }
  return "/local/avatar-card/";
})();

const I18N = {
  en: {
    idle: "Idle", listening: "Listening…", processing: "Thinking…", responding: "Speaking", unavailable: "Unavailable",
    choose: "Choose your assistant",
    mute: "Mute satellite microphone", unmute: "Unmute satellite microphone",
    need_https: "The microphone only works over an https:// address",
    no_mic: "No access to the microphone",
    no_assist: "Voice assistant is not available",
    bad_entity: "entity must be an assist_satellite.… entity",
    card_name: "Voice assistant avatar",
    card_desc: "Talking face for Assist — via a satellite or this device's microphone",
    names: { pilseta: "Niko", pilsetniece: "Lina", virietis: "Victor", sieviete: "Eva", holovirietis: "Orion", holosieviete: "Aura", elfs: "Twig", elfe: "Moss", robots: "Volt", inzenieris: "Theo", inzeniere: "Ada", lapsa: "Rusty" },
    ed: {
      entity: "Voice satellite (optional — without it this device listens)",
      avatars: "Avatars in the picker (long press on the face)",
      voice: "Where to listen and answer",
      v_auto: "Automatic", v_satellite: "Satellite", v_browser: "This device",
      sat: "Satellite", look: "Look and placement", more: "Advanced",
      wake_button: "Button that makes the satellite listen (VACA: …_wake)",
      mute_entity: "Satellite microphone mute switch",
      stt_entity: "Sensor: what you said",
      tts_entity: "Sensor: what it answered",
      size: "Face size in the card",
      expand: "Expand the face over the screen while talking",
      anchor: "Place over element (id, e.g. sams.ring)",
      anchor_scale: "Size relative to that element",
      pipeline: "Assistant used when this device answers",
      select_entity: "Shared avatar choice for all devices (input_select)",
      avatar_base: "Avatar folder (default: next to the card file)",
    },
  },
  lv: {
    idle: "Gaida", listening: "Klausās…", processing: "Domā…", responding: "Runā", unavailable: "Nav pieejams",
    choose: "Izvēlies palīgu",
    mute: "Izslēgt satelīta mikrofonu", unmute: "Ieslēgt satelīta mikrofonu",
    need_https: "Mikrofons strādā tikai caur https:// adresi",
    no_mic: "Nav piekļuves mikrofonam",
    no_assist: "Balss palīgs nav pieejams",
    bad_entity: "entity jābūt assist_satellite.… entītijai",
    card_name: "Balss palīga avatars",
    card_desc: "Runājoša seja balss palīgam — caur satelītu vai šīs ierīces mikrofonu",
    names: { pilseta: "Niko", pilsetniece: "Lina", virietis: "Viktors", sieviete: "Ieva", holovirietis: "Orions", holosieviete: "Aura", elfs: "Čiekurs", elfe: "Sūna", robots: "Volts", inzenieris: "Teodors", inzeniere: "Ada", lapsa: "Rudis" },
    ed: {
      entity: "Balss satelīts (nav obligāts — bez tā klausās pati ierīce)",
      avatars: "Palīgi izvēlē (ilgs spiediens uz sejas)",
      voice: "Kur klausīties un atbildēt",
      v_auto: "Automātiski", v_satellite: "Satelīts", v_browser: "Šī ierīce",
      sat: "Satelīts", look: "Izskats un novietojums", more: "Papildus",
      wake_button: "Poga, kas liek satelītam klausīties (VACA: …_wake)",
      mute_entity: "Satelīta mikrofona izslēgšana",
      stt_entity: "Sensors: ko teici",
      tts_entity: "Sensors: ko atbildēja",
      size: "Sejas izmērs kartītē",
      expand: "Runājot izplest seju pāri ekrānam",
      anchor: "Novietot virs elementa (id, piem. sams.ring)",
      anchor_scale: "Izmērs attiecībā pret elementu",
      pipeline: "Balss palīgs, kad atbild pati ierīce",
      select_entity: "Kopīga palīga izvēle visām ierīcēm (input_select)",
      avatar_base: "Avatāru mape (noklusēti: blakus kartītes failam)",
    },
  },
};

const langOf = (hass) => {
  const l = hass?.locale?.language || hass?.language || document.documentElement.lang || navigator.language || "en";
  return l.toLowerCase().startsWith("lv") ? "lv" : "en";
};

const FACE_SVG = `
<svg class="face" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#1d3f6e"/>
      <stop offset="0.6" stop-color="#0b1a33"/>
      <stop offset="1" stop-color="#050b18"/>
    </radialGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0c3a4"/>
      <stop offset="0.55" stop-color="#d9a283"/>
      <stop offset="1" stop-color="#b47a5e"/>
    </linearGradient>
    <linearGradient id="hair" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3426"/>
      <stop offset="1" stop-color="#2a1d15"/>
    </linearGradient>
    <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1b2c48"/>
      <stop offset="1" stop-color="#0a1222"/>
    </linearGradient>
    <radialGradient id="iris" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="#7fb4d8"/>
      <stop offset="1" stop-color="#2e5f86"/>
    </radialGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="disc"><circle cx="100" cy="100" r="100"/></clipPath>
  </defs>
  <g clip-path="url(#disc)">
    <rect width="200" height="200" fill="url(#bg)"/>
    <!-- pilsētas gaismas fonā -->
    <g filter="url(#soft)" opacity="0.55">
      <circle cx="28" cy="70" r="7" fill="#3fa7ff"/><circle cx="172" cy="62" r="6" fill="#57d0ff"/>
      <circle cx="18" cy="120" r="5" fill="#ff6fb1"/><circle cx="182" cy="118" r="7" fill="#3fa7ff"/>
      <circle cx="44" cy="40" r="4" fill="#9ee6ff"/><circle cx="160" cy="30" r="4" fill="#9ee6ff"/>
      <rect x="6" y="80" width="10" height="70" fill="#1f6fd1"/><rect x="186" y="74" width="10" height="80" fill="#1f6fd1"/>
    </g>
    <g class="body">
      <!-- pleci un kakls -->
      <path d="M22 200 C26 166 52 152 78 148 L122 148 C148 152 174 166 178 200 Z" fill="url(#suit)"/>
      <path d="M84 132 L116 132 L118 156 C108 164 92 164 82 156 Z" fill="#c48d70"/>
      <path d="M78 150 L100 176 L122 150" fill="none" stroke="#56d6ff" stroke-width="1.6" opacity="0.9"/>
      <path d="M60 172 L70 160 L84 160 M140 172 L130 160 L116 160" fill="none" stroke="#56d6ff" stroke-width="1" opacity="0.6"/>
      <circle cx="100" cy="176" r="2.2" fill="#9ef0ff"/>
      <g class="head">
        <!-- ausis -->
        <ellipse cx="60" cy="96" rx="7" ry="12" fill="#cf9576"/>
        <ellipse cx="140" cy="96" rx="7" ry="12" fill="#cf9576"/>
        <!-- seja -->
        <path d="M62 78 C62 46 80 34 100 34 C120 34 138 46 138 78 L138 100 C138 124 122 142 100 144 C78 142 62 124 62 100 Z" fill="url(#skin)"/>
        <!-- rugāji / īsa bārda -->
        <path d="M64 104 C66 126 82 142 100 144 C118 142 134 126 136 104 C130 116 122 120 116 118 C110 114 90 114 84 118 C78 120 70 116 64 104 Z" fill="#5a3f30" opacity="0.38"/>
        <!-- mati -->
        <path d="M60 82 C56 50 74 28 102 28 C128 28 146 46 140 82 C138 70 134 60 126 54 C114 50 98 54 84 50 C74 54 66 64 60 82 Z" fill="url(#hair)"/>
        <!-- uzacis -->
        <g class="brows">
          <path d="M72 72 C78 67 87 66 94 69" fill="none" stroke="#3a2a20" stroke-width="3.6" stroke-linecap="round"/>
          <path d="M106 69 C113 66 122 67 128 72" fill="none" stroke="#3a2a20" stroke-width="3.6" stroke-linecap="round"/>
        </g>
        <!-- acis -->
        <g class="eyes">
          <g class="eye">
            <ellipse cx="83" cy="84" rx="8.5" ry="5.2" fill="#f7f3ef"/>
            <g class="pupil"><circle cx="83" cy="84" r="4" fill="url(#iris)"/><circle cx="83" cy="84" r="1.8" fill="#0d1620"/><circle cx="84.4" cy="82.6" r="0.9" fill="#fff"/></g>
          </g>
          <g class="eye">
            <ellipse cx="117" cy="84" rx="8.5" ry="5.2" fill="#f7f3ef"/>
            <g class="pupil"><circle cx="117" cy="84" r="4" fill="url(#iris)"/><circle cx="117" cy="84" r="1.8" fill="#0d1620"/><circle cx="118.4" cy="82.6" r="0.9" fill="#fff"/></g>
          </g>
        </g>
        <!-- deguns -->
        <path d="M100 88 C99 98 96 104 94 107 C97 110 103 110 106 107" fill="none" stroke="#a86f55" stroke-width="1.8" stroke-linecap="round"/>
        <!-- mute -->
        <g class="mouth">
          <ellipse class="mouth-open" cx="100" cy="121" rx="8.5" ry="5" fill="#3b1714"/>
          <path d="M88 119.5 C94 122.5 106 122.5 112 119.5" fill="none" stroke="#8f4c40" stroke-width="2.4" stroke-linecap="round"/>
        </g>
        <!-- austiņa kā ENNY -->
        <path d="M137 102 C146 104 148 112 144 118" fill="none" stroke="#56d6ff" stroke-width="1.4" opacity="0.8"/>
        <circle cx="140" cy="100" r="3" fill="#0f2a44" stroke="#56d6ff" stroke-width="1"/>
      </g>
    </g>
  </g>
</svg>`;

// Skaņas viļņi ap apli: stabiņi no rādiusa ~76 uz āru (svg ir par 36 % lielāks nekā aplis → apļa malā r≈73.5).
const EQ_BARS = 60;
const EQ_SVG = (() => {
  let bars = "";
  for (let i = 0; i < EQ_BARS; i++) {
    const dur = (0.45 + Math.random() * 0.55).toFixed(2);
    const delay = (-Math.random() * 1.2).toFixed(2);
    bars += `<g transform="rotate(${(i * 360) / EQ_BARS} 100 100)"><rect class="bar" x="99" y="8" width="2.2" height="16" rx="1.1"
      style="animation-duration:${dur}s;animation-delay:${delay}s"/></g>`;
  }
  return `<svg class="eq" viewBox="0 0 200 200" aria-hidden="true">${bars}</svg>`;
})();

const STYLE = `
  :host { display: block; }
  ha-card { display: flex; align-items: center; gap: 14px; padding: 12px 16px; cursor: pointer; }
  .label { display: flex; flex-direction: column; min-width: 0; }
  .label .name { font-weight: 500; font-size: 16px; }
  .label .state { color: var(--secondary-text-color); font-size: 13px; }
  .avatar { position: relative; flex: none; border-radius: 50%; }
  .avatar .disc { position: absolute; inset: 0; border-radius: 50%; overflow: hidden;
    box-shadow: 0 0 0 2px rgba(86,214,255,.55), 0 0 18px rgba(63,167,255,.45); background: #050b18; }
  .avatar .disc > svg { width: 100%; height: 100%; display: block; }
  .avatar .disc > video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0;
    transform: scale(1.22); transform-origin: 50% 36%; transition: opacity .25s ease; }
  .avatar .disc > video.on.ready { opacity: 1; }
  .ring { position: absolute; inset: -7px; border-radius: 50%; pointer-events: none; }
  .eq { position: absolute; inset: -18%; width: 136%; height: 136%; pointer-events: none; opacity: 0; transition: opacity .3s ease; }
  .eq .bar { fill: #7fe3ff; transform-box: fill-box; transform-origin: center bottom; transform: scaleY(.15);
    animation: eq 0.8s ease-in-out infinite alternate; animation-play-state: paused; }
  @keyframes eq { 0% { transform: scaleY(.12); } 100% { transform: scaleY(1); } }
  [data-state="responding"] .eq { opacity: .9; }
  [data-state="responding"] .eq .bar { animation-play-state: running; }
  [data-state="listening"] .eq { opacity: .35; }

  /* --- fotogrāfija --- */
  .photo { width: 100%; height: 100%; object-fit: cover; object-position: 50% 42%; display: block;
    transform-origin: 50% 46%; animation: kenburns 9s ease-in-out infinite alternate; transition: filter .4s ease; }
  @keyframes kenburns { 0% { transform: scale(1.16) translate(0, 0); } 100% { transform: scale(1.23) translate(-1%, .6%); } }
  @keyframes speakPhoto { 0%, 100% { transform: scale(1.2) rotate(0) translateY(0); } 25% { transform: scale(1.205) rotate(-.7deg) translateY(.4%); }
    55% { transform: scale(1.2) rotate(.5deg) translateY(-.3%); } 80% { transform: scale(1.21) rotate(-.3deg) translateY(.2%); } }
  [data-state="listening"] .photo { filter: brightness(1.08) contrast(1.04); }
  [data-state="processing"] .photo { filter: brightness(.92) saturate(.85); }
  [data-state="responding"] .photo { animation: speakPhoto 2.4s ease-in-out infinite; }

  .mic { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); width: 30px; height: 30px;
    border-radius: 50%; background: rgba(10,22,40,.92); border: 1px solid rgba(86,214,255,.7);
    display: flex; align-items: center; justify-content: center; color: #9ef0ff; }
  .mic svg { width: 16px; height: 16px; fill: currentColor; }

  /* --- sejas animācijas --- */
  .face .head { transform-box: view-box; transform-origin: 100px 150px; }
  .face .eye { transform-box: fill-box; transform-origin: center; animation: blink 5.2s infinite; }
  .face .pupil { transition: transform .5s ease; }
  .face .brows { transition: transform .3s ease; }
  .face .mouth-open { transform-box: fill-box; transform-origin: center top; transform: scaleY(0.12); }
  .face .body { transform-box: view-box; transform-origin: 100px 200px; animation: breathe 4.5s ease-in-out infinite; }
  @keyframes blink { 0%, 93%, 100% { transform: scaleY(1); } 95.5% { transform: scaleY(0.08); } }
  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.012); } }
  @keyframes glance { 0%, 40%, 100% { transform: translate(0,0); } 50%, 65% { transform: translate(2.2px,0); } 75%, 88% { transform: translate(-1.8px,.5px); } }
  @keyframes talk {
    0% { transform: scaleY(.15); } 9% { transform: scaleY(.9); } 17% { transform: scaleY(.35); } 26% { transform: scaleY(1.1); }
    34% { transform: scaleY(.2); } 45% { transform: scaleY(.75); } 53% { transform: scaleY(.45); } 62% { transform: scaleY(1); }
    70% { transform: scaleY(.25); } 80% { transform: scaleY(.85); } 90% { transform: scaleY(.3); } 100% { transform: scaleY(.15); } }
  @keyframes nod { 0%, 100% { transform: rotate(0) translateY(0); } 30% { transform: rotate(-1.2deg) translateY(.6px); } 65% { transform: rotate(1deg) translateY(-.4px); } }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(86,214,255,.75); } 100% { box-shadow: 0 0 0 16px rgba(86,214,255,0); } }
  @keyframes spin { to { transform: rotate(360deg); } }

  [data-state="idle"] .face .pupil { animation: glance 9s ease-in-out infinite; }
  [data-state="listening"] .face .brows { transform: translateY(-2.5px); }
  [data-state="listening"] .face .head { transform: rotate(-3deg); transition: transform .4s ease; }
  [data-state="listening"] .ring { animation: pulse 1.3s ease-out infinite; }
  [data-state="processing"] .face .pupil { transform: translate(2.5px,-2px); }
  [data-state="processing"] .face .brows { transform: translateY(-1px); }
  [data-state="processing"] .ring { border: 3px solid transparent; border-top-color: #56d6ff; border-right-color: rgba(86,214,255,.35);
    animation: spin 1s linear infinite; }
  [data-state="responding"] .face .mouth-open { animation: talk 1.15s linear infinite; }
  [data-state="responding"] .face .head { animation: nod 2.6s ease-in-out infinite; }
  [data-state="responding"] .ring { box-shadow: 0 0 22px 4px rgba(86,214,255,.55); }

  /* --- piesaistīta citam elementam (anchor) --- */
  .anchored { position: fixed; z-index: 3; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .anchored .mic { display: none; }
  .anchored .ring { inset: -4px; }
  .muted .disc { filter: grayscale(1) brightness(.55); }
  .muted .disc::after { content: ""; position: absolute; left: 50%; top: 8%; width: 7%; height: 84%; margin-left: -3.5%;
    background: #ef5350; border-radius: 4px; transform: rotate(-45deg); box-shadow: 0 0 0 2px rgba(0,0,0,.35); }

  /* --- avatāru izvēle --- */
  .picker { position: fixed; inset: 0; z-index: 10; display: none; flex-direction: column; align-items: center; justify-content: center;
    gap: 22px; padding: 16px; box-sizing: border-box; background: rgba(3,8,18,.86); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
  .picker.show { display: flex; }
  .picker .hint { color: #9ec9e6; font-size: 15px; letter-spacing: .04em; }
  .faces { display: flex; flex-wrap: wrap; gap: 18px 22px; justify-content: center; max-width: 900px; }
  .face-btn { background: none; border: 0; padding: 0; color: #e8f6ff; display: flex; flex-direction: column; align-items: center; gap: 8px;
    cursor: pointer; font: inherit; font-size: 15px; -webkit-tap-highlight-color: transparent; }
  .face-btn img { width: clamp(72px, 15vw, 130px); aspect-ratio: 1; border-radius: 50%; object-fit: cover; object-position: 50% 32%;
    box-shadow: 0 0 0 2px rgba(86,214,255,.3); transition: box-shadow .2s ease, transform .2s ease; }
  .face-btn:hover img { transform: scale(1.04); }
  .face-btn.sel img { box-shadow: 0 0 0 3px #56d6ff, 0 0 20px rgba(86,214,255,.6); }
  .pick-actions button { background: rgba(10,22,40,.9); color: #9ef0ff; border: 1px solid rgba(86,214,255,.6); border-radius: 20px;
    padding: 9px 18px; font: inherit; font-size: 14px; cursor: pointer; }

  /* --- izplestais skats --- */
  .overlay { position: fixed; inset: 0; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 26px; background: rgba(3,8,18,.78); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
    opacity: 0; pointer-events: none; transition: opacity .35s ease; }
  .overlay.show { opacity: 1; pointer-events: auto; }
  .overlay .avatar { width: min(52vh, 70vw, 440px); height: min(52vh, 70vw, 440px); transform: scale(.6); transition: transform .45s cubic-bezier(.2,.9,.3,1.2); }
  .overlay.show .avatar { transform: scale(1); }
  .overlay .ring { inset: -12px; }
  .overlay .mic { width: 46px; height: 46px; bottom: -16px; }
  .overlay .mic svg { width: 24px; height: 24px; }
  .overlay .bubble { margin-top: calc(min(52vh, 70vw, 440px) * .14); }
  .bubble { max-width: min(80vw, 640px); text-align: center; color: #e8f6ff; font-size: clamp(16px, 2.6vh, 22px); line-height: 1.35;
    text-shadow: 0 1px 6px rgba(0,0,0,.6); min-height: 1.4em; }
  .bubble .you { color: #9ec9e6; font-size: .85em; display: block; margin-bottom: 6px; }
  @media (prefers-reduced-motion: reduce) {
    .face .eye, .face .body, [data-state="idle"] .face .pupil, [data-state="responding"] .face .head, .photo { animation: none !important; }
    .overlay .avatar { transition: none; }
  }
`;

// Mikrofona skaņa → 16 kHz Int16 gabali pa ~64 ms (kā HA balss dialogam).
const WORKLET_URL = URL.createObjectURL(new Blob([`
class AvatarRecorder extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(1024); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf, [this.buf.buffer]); this.buf = new Int16Array(1024); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("avatar-recorder", AvatarRecorder);
`], { type: "application/javascript" }));

// Gatavie avatāri (bilde <id>.jpg, klipi <id>_idle.mp4 / <id>_talk.mp4); vārdi — I18N[lang].names.
const CATALOG = ["pilseta", "pilsetniece", "virietis", "sieviete", "holovirietis", "holosieviete", "inzenieris", "inzeniere", "elfs", "elfe", "lapsa", "robots"].map((id) => ({ id }));

// 2.0.0 noklusētie vārdi, kas varēja palikt konfigurācijā — tos aizstāj ar jaunajiem.
const LEGACY_NAMES = new Set(["Sams", "Sam", "Vīrietis", "Man", "Sieviete", "Woman", "Elfs", "Elf", "Elfe", "Elf girl", "Robots", "Robot"]);
const isLegacyName = (f) => typeof f === "object" && CATALOG.some((c) => c.id === f.id) && LEGACY_NAMES.has(f.name);

const MIC = `<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3m5.3-3a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 6 6.9V21h2v-3.1a7 7 0 0 0 6-6.9z"/></svg>`;

class AvatarCard extends HTMLElement {
  setConfig(config) {
    if (config.entity && !config.entity.startsWith("assist_satellite.")) {
      throw new Error(I18N[langOf(this._hass)].bad_entity);
    }
    this._config = { size: 110, expand: true, voice: "auto", ...config };
    // auto: Android WebView, kas nav HA aplikācija (piem. VACA planšete), un ir satelīts → modina satelītu;
    // citur (dators, telefona HA aplikācija, pārlūks) vai bez satelīta → šīs ierīces mikrofons un skaļrunis.
    // Ierīcē var piespiest ar ?avatar_voice=browser|satellite|auto (atceras localStorage).
    let forced = null;
    try {
      const q = new URLSearchParams(location.search).get("avatar_voice");
      if (q === "auto") localStorage.removeItem("avatar-card-voice");
      else if (q) localStorage.setItem("avatar-card-voice", q);
      forced = localStorage.getItem("avatar-card-voice");
    } catch (e) { /* localStorage nav pieejams */ }
    const v = forced || this._config.voice;
    const ua = navigator.userAgent;
    const kiosk = /; wv\)/.test(ua) && !/Home ?Assistant/i.test(ua);
    this._local = !this._config.entity || v === "browser" || (v === "auto" && !kiosk);

    // Avatāri: saraksts (izvēle ar ilgu spiedienu); viens no image/videos; ja nav nekā — viss CATALOG.
    // Ierakstā pietiek ar id (+ name): bilde <avatar_base><id>.jpg, klipi <id>_idle.mp4 / <id>_talk.mp4.
    const c = this._config;
    let base = c.avatar_base ?? SCRIPT_DIR;
    if (base && !base.endsWith("/")) base += "/";
    // v2.0.0 ierakstīja konfigurācijā 6 palīgus ar noklusētajiem vārdiem — tāds saraksts nozīmē "visi".
    const legacyList = c.avatars?.length && c.avatars.every(isLegacyName);
    const list = c.avatars?.length && !legacyList ? c.avatars : c.image || c.videos ? null : CATALOG;
    this._faces = list
      ? list.map((f) => (typeof f === "string" ? { id: f } : f)).map((f) => ({
          id: f.id,
          name: isLegacyName(f) ? undefined : f.name, // tukšs → tulkotais vārds (_faceName)
          image: f.image || `${base}${f.id}.jpg`,
          videos: f.videos || { idle: `${base}${f.id}_idle.mp4`, responding: `${base}${f.id}_talk.mp4` },
        }))
      : [{ id: "default", name: c.name, image: c.image, videos: c.videos }];
    this._face = this._faces[0];
    this._built = false;
    this._state = null;
  }

  // Kopīga izvēle (select_entity, piem. input_select) > šīs ierīces izvēle (localStorage) > pirmais.
  _wantedFace() {
    const c = this._config;
    let id = null;
    const st = c.select_entity && this._hass.states[c.select_entity];
    if (st) id = st.state;
    else {
      try { id = localStorage.getItem("avatar-card-face"); } catch (e) { /* nav pieejams */ }
    }
    return this._faces.find((f) => f.id === id || f.name === id) || this._faces[0];
  }

  _t(key) {
    return I18N[this._lang || "en"][key];
  }

  _faceName(face) {
    return face.name || I18N[this._lang || "en"].names[face.id] || face.id;
  }

  _setFace(face) {
    this._face = face;
    const label = this.shadowRoot?.querySelector(".name");
    if (label) label.textContent = this._faceName(face);
    for (const el of [this._small, this._big]) {
      if (!el) continue;
      const disc = el.querySelector(".disc");
      disc._videos = null;
      disc.innerHTML = face.image ? `<img class="photo" alt="">` : FACE_SVG;
      this._fillImages(el);
      this._applyVideo(el, el.dataset.state || "idle");
    }
  }

  _chooseFace(face) {
    try { localStorage.setItem("avatar-card-face", face.id); } catch (e) { /* nav pieejams */ }
    if (this._config.select_entity) {
      this._hass.callService("input_select", "select_option", { entity_id: this._config.select_entity, option: face.id });
    }
    this._setFace(face);
  }

  _openPicker() {
    const p = this._picker;
    if (!p) return;
    const row = p.querySelector(".faces");
    row.innerHTML = "";
    for (const f of this._faces) {
      const b = document.createElement("button");
      b.className = "face-btn" + (f === this._face ? " sel" : "");
      const img = document.createElement("img");
      img.src = f.image || "";
      const name = document.createElement("span");
      name.textContent = this._faceName(f);
      b.append(img, name);
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this._chooseFace(f);
        p.classList.remove("show");
      });
      row.appendChild(b);
    }
    const actions = p.querySelector(".pick-actions");
    actions.innerHTML = "";
    const mute = this._config.mute_entity;
    if (mute && !this._local) {
      const on = this._hass.states[mute]?.state === "on";
      const b = document.createElement("button");
      b.textContent = this._t(on ? "unmute" : "mute");
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this._hass.callService("switch", "toggle", { entity_id: mute });
        p.classList.remove("show");
      });
      actions.appendChild(b);
    }
    p.classList.add("show");
  }

  static getStubConfig(hass) {
    const sat = Object.keys(hass.states).find((e) => e.startsWith("assist_satellite.vaca_"))
      || Object.keys(hass.states).find((e) => e.startsWith("assist_satellite."));
    const cfg = { entity: sat || "assist_satellite.", avatars: CATALOG.map((f) => f.id) };
    // VACA: assist_satellite.vaca_xxx → button.vaca_xxx_wake, switch.vaca_xxx_mute, sensor.vaca_xxx_stt/_tts
    const dev = sat?.split(".")[1];
    const has = (id) => (hass.states[id] ? id : undefined);
    if (dev) {
      Object.assign(cfg, {
        wake_button: has(`button.${dev}_wake`),
        mute_entity: has(`switch.${dev}_mute`),
        stt_entity: has(`sensor.${dev}_stt`),
        tts_entity: has(`sensor.${dev}_tts`),
      });
    }
    return Object.fromEntries(Object.entries(cfg).filter(([, v]) => v !== undefined));
  }

  static getConfigElement() {
    return document.createElement("avatar-card-editor");
  }

  getCardSize() { return 2; }
  getGridOptions() { return { columns: 6, rows: 2, min_rows: 2 }; }

  set hass(hass) {
    this._hass = hass;
    this._lang = langOf(hass);
    if (!this._built) {
      this._face = this._wantedFace();
      this._build();
    } else {
      const face = this._wantedFace();
      if (face !== this._face) this._setFace(face);
    }
    if (this._local || this._run) {
      // Šajā ierīcē runājam pa tiešo — satelīta (planšetes) stāvoklis seju nevada.
      if (this._state == null) this._setState("idle");
    } else {
      const st = hass.states[this._config.entity];
      const state = st ? (STATES.includes(st.state) ? st.state : st.state === "unavailable" ? "unavailable" : "idle") : "unavailable";
      if (state !== this._state) this._setState(state);
      const mute = this._config.mute_entity && hass.states[this._config.mute_entity];
      this._small?.classList.toggle("muted", mute?.state === "on");
    }
    this._updateText();
  }

  connectedCallback() {
    if (this._host && !this._host.isConnected) document.body.appendChild(this._host);
    // Pārlūks fonā aptur video; kad ekrāns atkal redzams, palaižam aktīvo klipu no jauna.
    this._onVisible = () => {
      if (document.hidden) return;
      for (const el of [this._small, this._big]) el?.querySelector("video.on")?.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", this._onVisible);
    if (this._config.anchor) {
      this._place = () => this._placeAnchored();
      window.addEventListener("resize", this._place);
      window.addEventListener("scroll", this._place, true);
      this._placeTimer = setInterval(this._place, 500);
    }
  }

  disconnectedCallback() {
    // Seja/izplestais skats dzīvo document.body (lai to neapgriež kartīšu konteineri); ar kartīti jāpazūd arī tiem.
    if (this._host) this._host.remove();
    document.removeEventListener("visibilitychange", this._onVisible);
    if (this._place) {
      window.removeEventListener("resize", this._place);
      window.removeEventListener("scroll", this._place, true);
      clearInterval(this._placeTimer);
    }
    this._anchorEl = null;
  }

  // anchor: elementa id (piem. floorplan SVG "sams.ring"), ko meklējam cauri visiem shadow DOM.
  _findAnchor() {
    if (this._anchorEl?.isConnected) return this._anchorEl;
    const now = Date.now();
    if (now - (this._anchorSearched || 0) < 2000) return null;
    this._anchorSearched = now;
    const id = this._config.anchor;
    const search = (root) => {
      const hit = root.getElementById(id);
      if (hit) return hit;
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) {
          const r = search(el.shadowRoot);
          if (r) return r;
        }
      }
      return null;
    };
    this._anchorEl = search(document);
    return this._anchorEl;
  }

  _placeAnchored() {
    const el = this._small;
    const a = this._findAnchor();
    const r = a?.getBoundingClientRect();
    if (!r || !r.width) {
      el.style.display = "none";
      return;
    }
    const size = Math.round(Math.max(r.width, r.height) * (this._config.anchor_scale || 1));
    Object.assign(el.style, {
      display: "",
      left: `${Math.round(r.left + r.width / 2 - size / 2)}px`,
      top: `${Math.round(r.top + r.height / 2 - size / 2)}px`,
      width: `${size}px`,
      height: `${size}px`,
    });
  }

  // Pieskāriens = klausīties; ilgs spiediens (ja ir mute_entity) = mute ieslēgt/izslēgt.
  _bindPress(el) {
    let timer = null, held = false;
    el.addEventListener("contextmenu", (e) => e.preventDefault()); // Android ilgais spiediens
    el.addEventListener("pointerdown", () => {
      held = false;
      const pick = this._faces.length > 1;
      if (!pick && (!this._config.mute_entity || this._local)) return;
      timer = setTimeout(() => {
        held = true;
        // Ilgs spiediens: avatāru izvēle (tur arī mute); ja avatārs tikai viens — uzreiz mute.
        if (pick) this._openPicker();
        else this._hass.callService("switch", "toggle", { entity_id: this._config.mute_entity });
      }, 650);
    });
    const cancel = () => clearTimeout(timer);
    el.addEventListener("pointerleave", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      cancel();
      if (!held) this._wake();
    });
  }

  _avatarHtml() {
    const face = this._face.image ? `<img class="photo" alt="">` : FACE_SVG;
    return `${EQ_SVG}<div class="ring"></div><div class="disc">${face}</div><div class="mic">${MIC}</div>`;
  }

  _fillImages(root) {
    if (this._face.image) root.querySelectorAll(".photo").forEach((img) => (img.src = this._face.image));
  }

  _build() {
    const c = this._config;
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    const pick = this._faces.length > 1;
    if (c.anchor || c.expand || pick) {
      this._host = document.createElement("div");
      const o = this._host.attachShadow({ mode: "open" });
      o.innerHTML = `<style>${STYLE}</style>
        ${c.anchor ? `<div class="avatar anchored" style="display:none">${this._avatarHtml()}</div>` : ""}
        ${c.expand ? `<div class="overlay"><div class="avatar">${this._avatarHtml()}</div><div class="bubble"></div></div>` : ""}
        ${pick ? `<div class="picker"><div class="hint">${this._t("choose")}</div><div class="faces"></div><div class="pick-actions"></div></div>` : ""}`;
      this._fillImages(o);
      if (pick) {
        this._picker = o.querySelector(".picker");
        this._picker.addEventListener("click", () => this._picker.classList.remove("show"));
      }
      if (c.expand) {
        this._overlay = o.querySelector(".overlay");
        this._big = this._overlay.querySelector(".avatar");
        this._bubble = o.querySelector(".bubble");
        this._bindPress(this._big);
        // Pieskāriens fonam paslēpj seju līdz nākamajai sarunai.
        this._overlay.addEventListener("click", () => {
          this._dismissed = true;
          this._overlay.classList.remove("show");
          this._small.style.visibility = "";
          if (this._run) this._finishLocal(this._run, false);
        });
      }
      if (c.anchor) this._small = o.querySelector(".anchored");
      document.body.appendChild(this._host);
    }

    if (c.anchor) {
      // Seja stāv virs cita elementa (piem. stāvplāna mikrofona) — pati kartīte neaizņem vietu.
      root.innerHTML = `<style>:host { display: block; height: 0; overflow: hidden; }</style>`;
      this._stateEl = null;
    } else {
      root.innerHTML = `<style>${STYLE}</style>
        <ha-card>
          <div class="avatar" style="width:${c.size}px;height:${c.size}px">${this._avatarHtml()}</div>
          <div class="label"><span class="name"></span><span class="state"></span></div>
        </ha-card>`;
      this._fillImages(root);
      root.querySelector(".name").textContent = this._faceName(this._face);
      root.querySelector("ha-card").addEventListener("click", () => this._wake());
      this._small = root.querySelector(".avatar");
      this._stateEl = root.querySelector(".state");
    }
    this._bindPress(this._small);
    this._built = true;
  }

  _setState(state) {
    this._state = state;
    const visual = state === "unavailable" ? "idle" : state;
    for (const el of [this._small, this._big]) {
      if (!el) continue;
      el.dataset.state = visual;
      this._applyVideo(el, visual);
    }
    if (this._stateEl) this._stateEl.textContent = this._t(state) || state;
    if (this._overlay) {
      if (state === "listening") this._dismissed = false;
      const show = visual !== "idle" && !this._dismissed;
      this._overlay.classList.toggle("show", show);
      // Lai caur fonu nespīd otra (mazā) seja.
      this._small.style.visibility = show ? "hidden" : "";
    }
  }

  // Katram klipam savs <video>, visi ielādēti uzreiz; stāvoklis tikai pārslēdz redzamo,
  // lai mainoties nebūtu melna mirkļa. Foto (ja ir) paliek apakšā, kamēr video ielādējas.
  _applyVideo(avatarEl, state) {
    const videos = this._face.videos;
    if (!videos) return;
    const src = videos[state] || videos.idle;
    if (!src) return;
    const disc = avatarEl.querySelector(".disc");
    if (!disc._videos) {
      disc._videos = new Map();
      for (const url of new Set(Object.values(videos))) {
        const v = document.createElement("video");
        Object.assign(v, { muted: true, loop: true, playsInline: true, preload: "auto" });
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        if (this._face.image) v.poster = this._face.image;
        // Rādām tikai tad, kad tiešām spēlē — citādi (piem. WebView bez autoplay) paliek foto/zīmētā seja.
        v.addEventListener("playing", () => v.classList.add("ready"));
        v.src = url;
        disc.appendChild(v);
        disc._videos.set(url, v);
      }
    }
    for (const [url, v] of disc._videos) {
      const on = url === src;
      v.classList.toggle("on", on);
      if (on) {
        if (state === "responding") v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    }
  }

  _updateText() {
    if (!this._bubble || this._errorShown) return;
    const h = this._hass, c = this._config;
    const val = (id) => {
      const s = id && h.states[id];
      return s && !["unknown", "unavailable", ""].includes(s.state) ? s.state : "";
    };
    const you = this._state === "listening" ? "" : this._local ? this._localYou || "" : val(c.stt_entity);
    const answer = this._state === "responding" ? (this._local ? this._localAnswer || "" : val(c.tts_entity)) : "";
    const key = `${this._state}|${you}|${answer}`;
    if (key === this._textKey) return;
    this._textKey = key;
    this._bubble.innerHTML = "";
    if (you) {
      const y = document.createElement("span");
      y.className = "you";
      y.textContent = `„${you}”`;
      this._bubble.appendChild(y);
    }
    if (answer) this._bubble.appendChild(document.createTextNode(answer));
  }

  _wake() {
    const c = this._config;
    this._dismissed = false;
    // assist_satellite supported_features: 2 = START_CONVERSATION
    const canStart = (this._hass.states[c.entity]?.attributes.supported_features ?? 0) & 2;
    if (this._local) {
      this._toggleLocal();
    } else if (c.wake_button) {
      this._hass.callService("button", "press", { entity_id: c.wake_button });
    } else if (canStart) {
      this._hass.callService("assist_satellite", "start_conversation", { entity_id: c.entity, start_message: "" });
    } else {
      // Satelītu nevar pamodināt no HA — runājam caur šo ierīci.
      this._toggleLocal();
    }
  }

  // --- Saruna caur šīs ierīces mikrofonu un skaļruni (HA assist_pipeline/run, kā HA balss dialogs) ---

  _toggleLocal() {
    const run = this._run;
    if (!run) return this._startLocal();
    if (this._state === "listening") this._stopMic(run);
    else this._finishLocal(run, false);
  }

  _localSay(you, answer) {
    this._localYou = you;
    this._localAnswer = answer;
    this._textKey = null;
    this._updateText();
  }

  async _startLocal() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this._showError(this._t("need_https"));
      return;
    }
    const run = (this._run = { buffer: [], handlerId: null, ended: false });
    this._localSay("", "");
    this._setState("listening");
    try {
      run.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      run.ctx = new AudioContext({ sampleRate: 16000 });
      await run.ctx.audioWorklet.addModule(WORKLET_URL);
      run.node = new AudioWorkletNode(run.ctx, "avatar-recorder");
      run.ctx.createMediaStreamSource(run.stream).connect(run.node);
      run.node.port.onmessage = (e) => (run.handlerId == null ? run.buffer.push(e.data) : this._sendAudio(run, e.data));
    } catch (err) {
      this._finishLocal(run, false);
      this._showError(this._t("no_mic"));
      return;
    }
    if (run.done) return;
    const c = this._config;
    // Ja nerunā, beidzam pēc 15 s.
    run.timer = setTimeout(() => this._stopMic(run), 15000);
    try {
      run.unsub = await this._hass.connection.subscribeMessage((ev) => this._onPipelineEvent(run, ev), {
        type: "assist_pipeline/run",
        start_stage: "stt",
        end_stage: "tts",
        input: { sample_rate: 16000 },
        ...(c.pipeline ? { pipeline: c.pipeline } : {}),
        // Saruna turpinās (konteksts) 5 min pēc pēdējās atbildes.
        ...(this._conversationId && Date.now() - this._conversationAt < 300000 ? { conversation_id: this._conversationId } : {}),
      });
      if (run.done) run.unsub();
    } catch (err) {
      this._finishLocal(run, false);
      this._showError(err?.message || this._t("no_assist"));
    }
  }

  _sendAudio(run, chunk) {
    const data = new Uint8Array(1 + chunk.byteLength);
    data[0] = run.handlerId;
    data.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), 1);
    this._hass.connection.socket.send(data);
  }

  _stopMic(run) {
    clearTimeout(run.timer);
    run.stream?.getTracks().forEach((t) => t.stop());
    run.ctx?.close().catch(() => {});
    run.stream = run.ctx = null;
    if (run.handlerId != null && !run.ended) {
      run.ended = true;
      this._hass.connection.socket.send(new Uint8Array([run.handlerId])); // audio beigas
    }
    if (!run.done && this._state === "listening") this._setState("processing");
  }

  _onPipelineEvent(run, ev) {
    if (run.done) return;
    const d = ev.data || {};
    switch (ev.type) {
      case "run-start":
        run.handlerId = d.runner_data.stt_binary_handler_id;
        run.buffer.splice(0).forEach((chunk) => this._sendAudio(run, chunk));
        if (!run.stream) this._stopMic(run); // mikrofons jau apturēts pirms servera atbildes
        break;
      case "stt-vad-end":
        this._stopMic(run);
        break;
      case "stt-end":
        this._stopMic(run);
        this._localSay(d.stt_output?.text || "", "");
        break;
      case "intent-end": {
        const out = d.intent_output || {};
        this._conversationId = out.conversation_id;
        this._conversationAt = Date.now();
        run.continue = !!out.continue_conversation;
        run.answer = out.response?.speech?.plain?.speech || "";
        break;
      }
      case "tts-end": {
        const url = d.tts_output?.url;
        if (!url) break;
        run.audio = new Audio(this._hass.hassUrl(url));
        run.audio.addEventListener("ended", () => this._finishLocal(run, run.continue));
        run.audio.addEventListener("error", () => this._finishLocal(run, false));
        this._localAnswer = run.answer;
        this._setState("responding");
        this._updateText();
        run.audio.play().catch(() => this._finishLocal(run, false));
        break;
      }
      case "run-end":
        if (!run.audio) this._finishLocal(run, false);
        break;
      case "error":
        this._finishLocal(run, false);
        // "Nekas netika teikts" nav kļūda, ko rādīt.
        if (!["stt-no-text-recognized", "stt-stream-failed"].includes(d.code)) this._showError(d.message || d.code);
        break;
    }
  }

  _finishLocal(run, again) {
    if (run.done) return;
    run.done = true;
    this._stopMic(run);
    run.unsub?.();
    if (run.audio) run.audio.pause();
    if (this._run === run) this._run = null;
    this._setState("idle");
    if (again && !this._dismissed) this._startLocal();
  }

  _showError(msg) {
    if (!this._bubble || !this._overlay) return;
    this._dismissed = false;
    this._overlay.classList.add("show");
    this._small.style.visibility = "hidden";
    this._bubble.textContent = msg;
    this._errorShown = true;
    clearTimeout(this._errTimer);
    this._errTimer = setTimeout(() => {
      this._errorShown = false;
      this._textKey = null;
      if (this._state === "idle") this._setState("idle");
    }, 3500);
  }
}

// --- Vizuālais redaktors (HA kartītes logā) ---

const editorSchema = (L) => [
  { name: "entity", selector: { entity: { domain: "assist_satellite" } } },
  {
    name: "avatars",
    selector: { select: { multiple: true, mode: "list", options: CATALOG.map((f) => ({ value: f.id, label: L.names[f.id] })) } },
  },
  {
    name: "voice",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "auto", label: L.ed.v_auto },
          { value: "satellite", label: L.ed.v_satellite },
          { value: "browser", label: L.ed.v_browser },
        ],
      },
    },
  },
  {
    type: "expandable",
    name: "",
    flatten: true,
    title: L.ed.sat,
    schema: [
      { name: "wake_button", selector: { entity: { domain: "button" } } },
      { name: "mute_entity", selector: { entity: { domain: "switch" } } },
      { name: "stt_entity", selector: { entity: { domain: "sensor" } } },
      { name: "tts_entity", selector: { entity: { domain: "sensor" } } },
    ],
  },
  {
    type: "expandable",
    name: "",
    flatten: true,
    title: L.ed.look,
    schema: [
      { name: "size", selector: { number: { min: 60, max: 300, step: 10, mode: "slider", unit_of_measurement: "px" } } },
      { name: "expand", selector: { boolean: {} } },
      { name: "anchor", selector: { text: {} } },
      { name: "anchor_scale", selector: { number: { min: 0.5, max: 3, step: 0.05, mode: "box" } } },
    ],
  },
  {
    type: "expandable",
    name: "",
    flatten: true,
    title: L.ed.more,
    schema: [
      { name: "pipeline", selector: { assist_pipeline: {} } },
      { name: "select_entity", selector: { entity: { domain: "input_select" } } },
      { name: "avatar_base", selector: { text: {} } },
    ],
  },
];

class AvatarCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    const relang = langOf(hass) !== langOf(this._hass);
    this._hass = hass;
    if (!this._form) return;
    this._form.hass = hass;
    if (relang) this._form.schema = editorSchema(I18N[langOf(hass)]);
  }

  _render() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => I18N[langOf(this._hass)].ed[s.name] ?? s.name;
      this._form.addEventListener("value-changed", (e) => this._changed(e.detail.value));
      this.appendChild(this._form);
    }
    const c = this._config;
    const own = c.avatars?.length && !c.avatars.every(isLegacyName);
    const avatars = (own ? c.avatars : c.image || c.videos ? [] : CATALOG).map((f) => (typeof f === "string" ? f : f.id));
    this._form.hass = this._hass;
    this._form.schema = editorSchema(I18N[langOf(this._hass)]);
    this._form.data = { voice: "auto", expand: true, size: 110, ...c, avatars };
  }

  _changed(value) {
    const old = this._config;
    const config = { ...old, ...value };
    // Saglabājam esošos nosaukumus/ceļus; jauniem — tikai id (vārds no CATALOG).
    const prev = Object.fromEntries((old.avatars || []).map((f) => (typeof f === "string" ? [f, f] : [f.id, f])));
    config.avatars = (value.avatars || []).map((id) => (prev[id] && !isLegacyName(prev[id]) ? prev[id] : id));
    if (config.avatars.length) {
      delete config.image;
      delete config.videos;
    }
    for (const [k, v] of Object.entries(config)) {
      if (v === "" || v === undefined || v === null) delete config[k];
    }
    if (config.voice === "auto") delete config.voice;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
}

// Ja kartīte ielādēta divreiz (piem. HACS + /local), otrā reize neko nedara.
if (!customElements.get("avatar-card")) {
  customElements.define("avatar-card-editor", AvatarCardEditor);
  customElements.define("avatar-card", AvatarCard);
}
window.customCards = window.customCards || [];
const L0 = I18N[langOf(null)];
if (!window.customCards.some((c) => c.type === "avatar-card")) {
  window.customCards.push({ type: "avatar-card", name: L0.card_name, description: L0.card_desc, preview: true });
}
console.info(`%c avatar-card ${VERSION} `, "background:#0b1a33;color:#56d6ff");
