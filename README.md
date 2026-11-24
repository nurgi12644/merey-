# Merey Beauty Studio — Netlify нұсқасы

Сайт + админ панель + дерекқор (Netlify Blobs). Бөлек сервер немесе дерекқор керек емес.

## Netlify-ға шығару (GitHub арқылы)
1. Бұл папканы GitHub-қа жүктеңіз (репозиторий).
2. netlify.com → Add new site → Import from Git → репозиторийді таңдаңыз. Басқа баптау керек емес (netlify.toml бар).
3. Site configuration → Environment variables бөлімінде үш айнымалы қосыңыз:
   - `ADMIN_USER` — админ логині (merey)
   - `ADMIN_PASSWORD` — админ паролі
   - `SESSION_SECRET` — кездейсоқ ұзын мәтін (кемінде 32 таңба)
4. Deploys → Trigger deploy. Дайын!

Админ панель: `сайт-мекенжайы/admin`

Деректер (бағалар, пікірлер, нөмір) Netlify Blobs-та сақталады — қайта deploy жасағанда жойылмайды.

## Локалда тексеру
`npm i -g netlify-cli`, `netlify dev` (`.env` файлына 3 айнымалыны жазыңыз).
