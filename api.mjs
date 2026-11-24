import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

const { ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET } = process.env;

const DEFAULT = {
  settings: { name: "Merey Beauty Studio", tagline: "Кірпік жасау — сіздің көзіңізге ерекше көрініс береміз", phone: "+7 700 000 00 00", address: "Мекенжайды админ панельден енгізіңіз", hours: "Күнде 10:00 – 20:00", instagram: "merey_beauty_studio" },
  masters: [
    {
      "name": "Топ Мастер Мерей",
      "items": [
        {
          "name": "Классика",
          "price": "7000 тг"
        },
        {
          "name": "2D",
          "price": "8000 тг"
        },
        {
          "name": "3D",
          "price": "9000 тг"
        },
        {
          "name": "4D",
          "price": "10 000 тг"
        },
        {
          "name": "Эффекты, цветные ресницы, изгибы L, M, CC",
          "price": "+1000 тг"
        },
        {
          "name": "Снятие ресниц",
          "price": "1000 тг"
        },
        {
          "name": "Снятие ресниц (своя)",
          "price": "бесплатно"
        },
        {
          "name": "Ламинирование ресниц",
          "price": "6000 тг"
        },
        {
          "name": "Ламинирование бровей",
          "price": "5000 тг"
        }
      ]
    },
    {
      "name": "Мастер Аңсаған",
      "items": [
        {
          "name": "Классика",
          "price": "4000 тг"
        },
        {
          "name": "2D",
          "price": "5000 тг"
        },
        {
          "name": "3D",
          "price": "6000 тг"
        },
        {
          "name": "4D",
          "price": "7000 тг"
        },
        {
          "name": "Эффекты",
          "price": "+1000 тг"
        },
        {
          "name": "Цветные ресницы",
          "price": "+1000 тг"
        },
        {
          "name": "Снятие ресниц",
          "price": "1000 тг"
        },
        {
          "name": "Снятие ресниц (своя)",
          "price": "бесплатно"
        }
      ]
    },
    {
      "name": "Мастер Нарқыз",
      "items": [
        {
          "name": "Классика",
          "price": "5000 тг"
        },
        {
          "name": "2D",
          "price": "6000 тг"
        },
        {
          "name": "3D",
          "price": "7000 тг"
        },
        {
          "name": "4D",
          "price": "8000 тг"
        },
        {
          "name": "Эффекты",
          "price": "+1000 тг"
        },
        {
          "name": "Цветные ресницы",
          "price": "+1000 тг"
        },
        {
          "name": "Снятие ресниц",
          "price": "1000 тг"
        },
        {
          "name": "Снятие ресниц (своя)",
          "price": "бесплатно"
        }
      ]
    }
  ],
  reviews: [
    { author: "Айгерім", text: "Өте ұнады! Кірпіктер әдемі, ұзақ тұрады.", stars: 5 },
    { author: "Динара", text: "Таза, жайлы студия. Шебері өте мұқият.", stars: 5 },
    { author: "Жанар", text: "Үшінші рет келемін, нәтижесі керемет.", stars: 5 },
  ],
};

const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

const sign = (s) => crypto.createHmac("sha256", SESSION_SECRET).update(s).digest("hex");
const makeToken = () => { const exp = Date.now() + 7 * 864e5; return `${exp}.${sign(String(exp))}`; };
const validToken = (t) => {
  if (!t) return false;
  const [exp, sig] = t.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const cookie = (req, n) => (req.headers.get("cookie") || "").split(";").map((c) => c.trim().split("=")).find((c) => c[0] === n)?.[1];
const isAdmin = (req) => validToken(cookie(req, "sid"));
const h = (s) => crypto.createHash("sha256").update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(h(a), h(b));
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const COOKIE = "sid=%v; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=%a";

export default async (req, context) => {
  if (!ADMIN_USER || !ADMIN_PASSWORD || !SESSION_SECRET || SESSION_SECRET.length < 16)
    return json({ error: "Netlify-да ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET бапталмаған" }, 500);

  const path = new URL(req.url).pathname.replace(/^\/api/, "");
  const store = getStore("merey");
  const load = async () => { const c = (await store.get("content", { type: "json" })) || DEFAULT; return c.masters ? c : { ...c, masters: DEFAULT.masters }; };

  if (path === "/content" && req.method === "GET") return json(await load());

  if (path === "/me") return json({ admin: isAdmin(req) });

  if (path === "/logout" && req.method === "POST")
    return json({ ok: true }, 200, { "Set-Cookie": COOKIE.replace("%v", "").replace("%a", "0") });

  if (path === "/login" && req.method === "POST") {
    const key = "tries-" + String(context.ip || "x").replace(/[^a-zA-Z0-9]/g, "_");
    const t = (await store.get(key, { type: "json" })) || { n: 0, until: 0 };
    if (t.until > Date.now()) return json({ error: "Тым көп әрекет. 15 минуттан кейін қайталаңыз" }, 429);
    const b = await req.json().catch(() => ({}));
    if (same(b.login ?? "", ADMIN_USER) && same(b.password ?? "", ADMIN_PASSWORD)) {
      await store.delete(key);
      return json({ ok: true }, 200, { "Set-Cookie": COOKIE.replace("%v", makeToken()).replace("%a", String(7 * 86400)) });
    }
    t.n++; if (t.n >= 5) { t.until = Date.now() + 15 * 60e3; t.n = 0; }
    await store.setJSON(key, t);
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "Логин немесе пароль қате" }, 401);
  }

  if (path === "/content" && req.method === "PUT") {
    if (!isAdmin(req)) return json({ error: "Кіру қажет" }, 401);
    const b = await req.json().catch(() => null);
    if (!b || !Array.isArray(b.masters) || !Array.isArray(b.reviews) || b.masters.length > 20 || b.reviews.length > 200)
      return json({ error: "Қате деректер" }, 400);
    const cur = await load(), s = b.settings || {};
    const settings = { ...cur.settings };
    for (const k of ["name", "tagline", "phone", "address", "hours", "instagram"]) if (k in s) settings[k] = str(s[k], 300);
    await store.setJSON("content", {
      settings,
      masters: b.masters.map((m) => ({ name: str(m.name, 100), items: (Array.isArray(m.items) ? m.items : []).slice(0, 60).map((x) => ({ name: str(x.name, 120), price: str(x.price, 40) })) })),
      reviews: b.reviews.map((r) => ({ author: str(r.author, 60), text: str(r.text, 600), stars: Math.min(5, Math.max(1, parseInt(r.stars) || 5)) })),
    });
    return json({ ok: true });
  }

  return json({ error: "Табылмады" }, 404);
};
