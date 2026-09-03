// Copyright 2026 GSF-001
//
// Licensed under the ARCLUX MMO License v1 (GSF-001) — Source-available, No Commercial Game Clone.
// See LICENSE-MMO in the repo root. SPDX: LicenseRef-ARCLUX-MMO.
// Engine (apps/web, packages/engine, etc.) remains Apache-2.0 (LICENSE-ENGINE).
//
// apps/game/src/renderer/landing.ts — MMO LANDING AAA+ (EVE-grade cinematic)
// Background = live scene3d.ts CCTV (bukan static image), glass panels, thin
// borders, orange accent, HUD typography. Semua interaktif — bukan tempelan.
// Wire ke DIRECTORY + RegionSnapshot live.

import { colors } from "../ui/tokens";

export interface LandingHandle {
  dispose(): void;
  setStats(stats: { players: number; regions: number; factions: number; destroyed: number }): void;
}

export function initLanding(opts: { onLaunch: () => void; onTrailer?: () => void }): LandingHandle {
  const app = document.getElementById("app");
  if (!app) return { dispose() {}, setStats() {} };

  // Root overlay — di atas canvas three, glass
  const root = document.createElement("div");
  root.id = "arclux-landing";
  root.style.cssText = "position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(180deg, rgba(2,3,18,0.58) 0%, rgba(2,3,10,0.72) 45%, rgba(2,3,10,0.88) 100%);backdrop-filter: blur(0.5px);";

  // Inject AAA styles — glass, thin borders, orange accent, HUD typography
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Orbitron:wght@700;900&display=swap');
    #arclux-landing * { box-sizing: border-box; }
    #arclux-landing .nav { height: 64px; display:flex; align-items:center; justify-content:space-between; padding:0 28px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(8,12,28,0.62); backdrop-filter:blur(12px); }
    #arclux-landing .nav-links { display:flex; gap:22px; align-items:center; font-family:"JetBrains Mono", monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; }
    #arclux-landing .nav-links a { color:rgba(201,214,255,0.72); text-decoration:none; cursor:pointer; transition:color 0.15s; }
    #arclux-landing .nav-links a:hover { color:${colors.tactical}; }
    #arclux-landing .btn-launch { padding:10px 18px; border:1px solid ${colors.tactical}; color:${colors.tactical}; background:rgba(255,179,107,0.08); font-family:"JetBrains Mono", monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; cursor:pointer; transition:all 0.15s; }
    #arclux-landing .btn-launch:hover { background:${colors.tactical}; color:#0a0e1a; box-shadow:0 0 18px rgba(255,179,107,0.45); }
    #arclux-landing .hero { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:48px 24px 24px; }
    #arclux-landing .hero-title { font-family:"Orbitron", sans-serif; font-weight:900; font-size:clamp(42px, 7vw, 84px); letter-spacing:0.12em; color:#eaf0ff; text-shadow:0 0 32px rgba(82,200,255,0.35), 0 2px 0 rgba(0,0,0,0.8); margin:0; }
    #arclux-landing .hero-tagline { font-family:"JetBrains Mono", monospace; font-size:11px; letter-spacing:0.32em; text-transform:uppercase; color:${colors.tech}; margin:12px 0 18px; }
    #arclux-landing .hero-desc { max-width:680px; font-family:"JetBrains Mono", monospace; font-size:13px; line-height:1.7; color:rgba(201,214,255,0.72); margin:0 auto 28px; }
    #arclux-landing .cta-row { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
    #arclux-landing .cta-primary { padding:14px 28px; background:${colors.tactical}; color:#0a0e1a; border:1px solid ${colors.tactical}; font-family:"JetBrains Mono", monospace; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; font-weight:700; cursor:pointer; transition:all 0.15s; }
    #arclux-landing .cta-primary:hover { background:#ffd29a; border-color:#ffd29a; box-shadow:0 0 24px rgba(255,179,107,0.55); transform:translateY(-1px); }
    #arclux-landing .cta-secondary { padding:14px 28px; background:rgba(201,214,255,0.06); color:#c9d6ff; border:1px solid rgba(201,214,255,0.18); font-family:"JetBrains Mono", monospace; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; cursor:pointer; transition:all 0.15s; backdrop-filter:blur(6px); }
    #arclux-landing .cta-secondary:hover { background:rgba(201,214,255,0.12); border-color:rgba(201,214,255,0.32); color:#eaf0ff; }
    #arclux-landing .stats { display:flex; justify-content:center; gap:0; border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(4,7,18,0.72); backdrop-filter:blur(10px); }
    #arclux-landing .stat { flex:1; max-width:280px; padding:18px 20px; text-align:center; border-right:1px solid rgba(255,255,255,0.06); }
    #arclux-landing .stat:last-child { border-right:none; }
    #arclux-landing .stat-label { font-family:"JetBrains Mono", monospace; font-size:9px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(201,214,255,0.5); margin-bottom:6px; }
    #arclux-landing .stat-value { font-family:"Orbitron", sans-serif; font-weight:700; font-size:26px; letter-spacing:0.06em; color:#eaf0ff; }
    #arclux-landing .stat-value.accent { color:${colors.tactical}; text-shadow:0 0 12px rgba(255,179,107,0.45); }
    #arclux-landing .live-universe { display:flex; gap:18px; padding:22px 28px; background:rgba(2,3,10,0.55); }
    #arclux-landing .cards { flex:1; display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
    #arclux-landing .card { padding:22px 18px; background:rgba(12,16,32,0.62); border:1px solid rgba(201,214,255,0.08); backdrop-filter:blur(8px); cursor:pointer; transition:all 0.15s; }
    #arclux-landing .card:hover { border-color:rgba(255,179,107,0.32); background:rgba(18,24,48,0.72); transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.4); }
    #arclux-landing .card-icon { width:36px; height:36px; border:1px solid rgba(255,179,107,0.24); display:flex; align-items:center; justify-content:center; font-size:18px; margin-bottom:14px; }
    #arclux-landing .card-title { font-family:"JetBrains Mono", monospace; font-size:12px; letter-spacing:0.16em; text-transform:uppercase; color:#eaf0ff; margin-bottom:8px; }
    #arclux-landing .card-desc { font-family:"JetBrains Mono", monospace; font-size:11px; line-height:1.6; color:rgba(201,214,255,0.6); }
    #arclux-landing .news { width:340px; background:rgba(12,16,32,0.62); border:1px solid rgba(201,214,255,0.08); backdrop-filter:blur(8px); display:flex; flex-direction:column; }
    #arclux-landing .news-head { display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06); }
    #arclux-landing .news-title { font-family:"JetBrains Mono", monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:#eaf0ff; }
    #arclux-landing .news-view { font-family:"JetBrains Mono", monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:${colors.tactical}; cursor:pointer; }
    #arclux-landing .news-item { padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.04); cursor:pointer; transition:background 0.12s; }
    #arclux-landing .news-item:hover { background:rgba(255,179,107,0.06); }
    #arclux-landing .news-item-title { font-family:"JetBrains Mono", monospace; font-size:11px; color:#c9d6ff; margin-bottom:4px; }
    #arclux-landing .news-item-meta { font-family:"JetBrains Mono", monospace; font-size:9px; color:rgba(201,214,255,0.42); }
    #arclux-landing .footer { padding:18px 28px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.06); background:rgba(4,7,18,0.82); font-family:"JetBrains Mono", monospace; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(201,214,255,0.42); }
    #arclux-landing .footer a { color:rgba(201,214,255,0.62); text-decoration:none; margin-left:16px; }
    #arclux-landing .footer a:hover { color:${colors.tactical}; }
    @media (max-width: 900px) { #arclux-landing .cards { grid-template-columns:1fr; } #arclux-landing .live-universe { flex-direction:column; } #arclux-landing .news { width:100%; } #arclux-landing .nav-links { display:none; } }
  `;
  document.head.appendChild(style);

  // NAV
  const nav = document.createElement("nav");
  nav.className = "nav";
  const navLeft = document.createElement("div");
  navLeft.style.cssText = "display:flex;align-items:center;gap:18px;";
  const logo = document.createElement("img");
  logo.src = "/arclux-logo.svg";
  logo.alt = "ARCLUX";
  logo.style.cssText = "height:28px; width:auto; object-fit:contain; cursor:pointer;";
  logo.onerror = () => { (logo as HTMLImageElement).src = "/arclux-logo.png"; logo.onerror = () => { logo.style.display = "none"; }; };
  logo.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const logoText = document.createElement("span");
  logoText.textContent = "ARCLUX";
  logoText.style.cssText = "font-family:Orbitron,sans-serif;font-weight:900;letter-spacing:0.18em;color:#eaf0ff;cursor:pointer;";
  logoText.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  navLeft.append(logo, logoText);

  const navLinks = document.createElement("div");
  navLinks.className = "nav-links";
  const links = [
    ["HOME", () => window.scrollTo({ top: 0, behavior: "smooth" })],
    ["UNIVERSE", () => document.querySelector<HTMLElement>(".live-universe")?.scrollIntoView({ behavior: "smooth" })],
    ["FEATURES", () => document.querySelector<HTMLElement>(".cards")?.scrollIntoView({ behavior: "smooth" })],
    ["FACTIONS", () => alert("Factions — coming soon (governance.ts community)"),],
    ["MEDIA", () => opts.onTrailer?.() ?? alert("Trailer — coming soon")],
    ["ROADMAP", () => window.open("https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/docs/blueprint/", "_blank")],
    ["DOCS", () => window.open("https://github.com/GSF-001/ARCLUX", "_blank")],
  ] as const;
  for (const [label, fn] of links) {
    const a = document.createElement("a");
    a.textContent = label;
    a.onclick = fn as unknown as (e: MouseEvent) => void;
    navLinks.appendChild(a);
  }
  // language selector placeholder
  const lang = document.createElement("span");
  lang.textContent = "EN";
  lang.style.cssText = "color:rgba(201,214,255,0.5);cursor:pointer;border:1px solid rgba(201,214,255,0.12);padding:4px 8px;";
  lang.onclick = () => alert("Language — EN only for now");
  navLinks.appendChild(lang);

  const launchBtn = document.createElement("button");
  launchBtn.className = "btn-launch";
  launchBtn.textContent = "LAUNCH GAME";
  launchBtn.onclick = opts.onLaunch;

  const navRight = document.createElement("div");
  navRight.style.cssText = "display:flex;align-items:center;gap:16px;";
  navRight.append(navLinks, launchBtn);
  nav.append(navLeft, navRight);

  // HERO — background live scene3d CCTV (canvas di belakang root, jadi terlihat)
  const hero = document.createElement("section");
  hero.className = "hero";
  const title = document.createElement("h1");
  title.className = "hero-title";
  title.textContent = "ARCLUX";
  const tagline = document.createElement("div");
  tagline.className = "hero-tagline";
  tagline.textContent = "The Universe is the Interface · The Repository is the Vessel";
  const desc = document.createElement("p");
  desc.className = "hero-desc";
  desc.textContent = "A persistent world where every repository becomes a vessel. Build, trade, and survive in a living universe — self-host your own region, own your code, own your ship.";
  const ctaRow = document.createElement("div");
  ctaRow.className = "cta-row";
  const playBtn = document.createElement("button");
  playBtn.className = "cta-primary";
  playBtn.textContent = "PLAY NOW";
  playBtn.onclick = opts.onLaunch;
  const trailerBtn = document.createElement("button");
  trailerBtn.className = "cta-secondary";
  trailerBtn.textContent = "WATCH TRAILER";
  trailerBtn.onclick = () => opts.onTrailer?.() ?? alert("Trailer — coming soon");
  ctaRow.append(playBtn, trailerBtn);
  hero.append(title, tagline, desc, ctaRow);

  // LIVE STATS — glass bar, values live (update via setStats)
  const stats = document.createElement("section");
  stats.className = "stats";
  const makeStat = (label: string, id: string, isAccent = false): HTMLElement => {
    const el = document.createElement("div");
    el.className = "stat";
    const lab = document.createElement("div");
    lab.className = "stat-label";
    lab.textContent = label;
    const val = document.createElement("div");
    val.className = isAccent ? "stat-value accent" : "stat-value";
    val.id = id;
    val.textContent = "—";
    el.append(lab, val);
    return el;
  };
  const statPlayers = makeStat("PLAYERS ONLINE", "stat-players", true);
  const statRegions = makeStat("REGIONS ONLINE", "stat-regions");
  const statFactions = makeStat("FACTIONS", "stat-factions");
  const statDestroyed = makeStat("SHIPS DESTROYED", "stat-destroyed");
  stats.append(statPlayers, statRegions, statFactions, statDestroyed);

  // LIVE UNIVERSE — 3 cards + news
  const live = document.createElement("section");
  live.className = "live-universe";
  const cards = document.createElement("div");
  cards.className = "cards";
  const cardData = [
    { icon: "◈", title: "PERSISTENT WORLD", desc: "Regions never reset. Every wreckage, trade, and battle is archived — lineage.ts provenance survives.", onClick: () => document.querySelector<HTMLElement>(".stats")?.scrollIntoView({ behavior: "smooth" }) },
    { icon: "⬡", title: "PLAYER DRIVEN", desc: "1 repo → 1 vessel D-007. You design the hull, systems, and components — universe validates.", onClick: () => window.open("https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/docs/blueprint/05-vessel-design-dashboard.md", "_blank") },
    { icon: "⬢", title: "REAL CONSEQUENCES", desc: "Damage is per-subsystem combat.ts:39 + thermics + collision — repair = commit, not a button.", onClick: () => window.open("https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/docs/blueprint/03-combat.md", "_blank") },
  ];
  for (const c of cardData) {
    const card = document.createElement("div");
    card.className = "card";
    card.onclick = c.onClick;
    const ic = document.createElement("div");
    ic.className = "card-icon";
    ic.textContent = c.icon;
    const t = document.createElement("div");
    t.className = "card-title";
    t.textContent = c.title;
    const d = document.createElement("div");
    d.className = "card-desc";
    d.textContent = c.desc;
    card.append(ic, t, d);
    cards.appendChild(card);
  }
  const news = document.createElement("aside");
  news.className = "news";
  const newsHead = document.createElement("div");
  newsHead.className = "news-head";
  const newsTitle = document.createElement("div");
  newsTitle.className = "news-title";
  newsTitle.textContent = "UNIVERSE NEWS";
  const viewAll = document.createElement("span");
  viewAll.className = "news-view";
  viewAll.textContent = "VIEW ALL →";
  viewAll.onclick = () => window.open("https://github.com/GSF-001/ARCLUX/commits/ARCLUX.main", "_blank");
  newsHead.append(newsTitle, viewAll);
  news.appendChild(newsHead);
  const newsItems = [
    { t: "WRECKAGE #042 — Nova Fleet · Event #182", m: "2 hours ago · 17 components recovered", href: "https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/docs/blueprint/04-wreckage-history.md" },
    { t: "FACTION TREATY — Aurora Council", m: "5 hours ago · 3 regions", href: "https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/docs/blueprint/06-community-social-ownership.md" },
    { t: "SOLAR STORM — System Helion", m: "1 day ago · thermics overheat", href: "https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/docs/blueprint/08-persistent-world.md" },
  ];
  for (const n of newsItems) {
    const it = document.createElement("div");
    it.className = "news-item";
    it.onclick = () => window.open(n.href, "_blank");
    const tt = document.createElement("div");
    tt.className = "news-item-title";
    tt.textContent = n.t;
    const mm = document.createElement("div");
    mm.className = "news-item-meta";
    mm.textContent = n.m;
    it.append(tt, mm);
    news.appendChild(it);
  }
  live.append(cards, news);

  // FOOTER — sci-fi strip
  const footer = document.createElement("footer");
  footer.className = "footer";
  const footLeft = document.createElement("div");
  footLeft.textContent = "ARCLUX ENGINE · APACHE 2.0 · MMO v1";
  const footRight = document.createElement("div");
  const links2 = [
    ["POWERED BY THREE.JS", "https://threejs.org/"],
    ["DEDICATED SERVERS", "https://github.com/GSF-001/ARCLUX/tree/ARCLUX.main/packages/gameserver"],
    ["SECURE & FAIR", "https://github.com/GSF-001/ARCLUX/blob/ARCLUX.main/SECURITY.md"],
  ] as const;
  for (const [label, href] of links2) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    a.target = "_blank";
    footRight.appendChild(a);
  }
  const social = document.createElement("span");
  social.textContent = "  GITHUB · DISCORD";
  social.style.cursor = "pointer";
  social.onclick = () => window.open("https://github.com/GSF-001/ARCLUX", "_blank");
  footRight.appendChild(social);
  footer.append(footLeft, footRight);

  root.append(nav, hero, stats, live, footer);
  app.appendChild(root);

  const setStats = (s: { players: number; regions: number; factions: number; destroyed: number }): void => {
    const elP = document.getElementById("stat-players");
    const elR = document.getElementById("stat-regions");
    const elF = document.getElementById("stat-factions");
    const elD = document.getElementById("stat-destroyed");
    if (elP) elP.textContent = String(s.players);
    if (elR) elR.textContent = String(s.regions);
    if (elF) elF.textContent = String(s.factions);
    if (elD) elD.textContent = String(s.destroyed);
  };

  const dispose = (): void => {
    root.remove();
    style.remove();
  };

  return { dispose, setStats };
}
