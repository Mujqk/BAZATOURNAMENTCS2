# BAZA CS2 — Платформа турниров сообщества

Статическая веб-платформа для проведения локальных турниров сообщества **BAZA CS2** с олимпийской сеткой (Single Elimination), авторизацией через Discord, интеграцией Faceit Data API v4 и бэкендом на Supabase (Postgres + RLS + Edge Functions).

Сайт разработан в строгом темно-фиолетовом стиле **Material You (Material Design 3)**, адаптирован под отображение времени в местном часовом поясе каждого пользователя и готов к моментальному деплою на **GitHub Pages**.

---

## 📋 Ответы на частые вопросы по запуску

### 1. Что требуется от вас и какие ключи нужны?
- **Supabase Project URL** (вида `https://<ваш_проект>.supabase.co`)
- **Supabase Public Anon Key** (публичный ключ `eyJhbGci...`, находится в Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project API keys &rarr; `anon / public`)
- **Discord OAuth**: Client ID и Client Secret из Discord Developer Portal (вводятся вами в панели Supabase Dashboard &rarr; Authentication &rarr; Providers &rarr; Discord)
- **Faceit API Key**: регистрируется на [developers.faceit.com](https://developers.faceit.com/). Ключ сохраняется в секретах Supabase через команду `supabase secrets set FACEIT_API_KEY=...` (фронтенд его никогда не видит).

### 2. Где и как добавлять администраторов?
Назначение админов происходит без отдельного интерфейса, напрямую в базе Supabase (в разделе **SQL Editor** или **Table Editor**):
1. Человек хотя бы раз нажимает на сайте «Войти через Discord» — в таблице `profiles` автоматически появляется его профиль.
2. В **SQL Editor** вы выполняете запрос:
   ```sql
   update public.profiles
   set is_admin = true
   where discord_username = 'имя_пользователя_в_дискорде';
   ```
   *После этого при обновлении страницы у него сразу открывается доступ к созданию турниров и управлению сеткой.*

### 3. Что выкладывать в GitHub Pages?
Вам **не нужно вручную собирать файлы или создавать отдельные сервера**:
- Просто создайте репозиторий на GitHub и запушьте в него весь проект целиком:
  ```bash
  git init
  git add .
  git commit -m "feat: initial BAZA CS2 tournament platform"
  git remote add origin https://github.com/<ваш_аккаунт>/<имя_репозитория>.git
  git push -u origin main
  ```
- В репозитории на GitHub зайдите в **Settings &rarr; Pages &rarr; Source** и выберите **GitHub Actions**.
- В проект уже добавлен готовый файл `.github/workflows/deploy.yml`, который при каждом коммите будет сам компилировать код и выкладывать его на GitHub Pages.

### 4. Адаптивность времени под часовые пояса
- В базе данных Supabase время хранится в формате `timestamptz` (стандарт UTC).
- На сайте встроен механизм автоматического пересчета: если вы выставили старт турнира на **21:00 по МСК**, то:
  - Игрок в Москве увидит: `21:00 (МСК / UTC+3)`
  - Игрок в Екатеринбурге увидит: `23:00 (UTC+5)`
  - Игрок во Владивостоке увидит: `04:00 (UTC+10)`
  Каждый участник видит точное время по часам своего устройства.

### 5. Будут ли демо-турниры и переключалка админа в готовом сайте?
**Нет, они автоматически исчезают:**
- Пока ключи к Supabase не введены, сайт находится в режиме ознакомительного превью.
- Как только в `.env` или через кнопку настроек указываются реальные `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`:
  1. Переключатель «Админ / Игрок / Гость» **полностью скрывается**.
  2. Демо-турниры **не отображаются** — сайт загружает исключительно реальные турниры из вашей базы данных Supabase.
  3. Права админа определяются исключительно флагом `is_admin = true` в вашей БД.

---

## 🚀 Локальный запуск

```bash
# Установка зависимостей
pnpm install

# Запуск dev-сервера
pnpm dev
```
Сайт откроется по адресу: `http://localhost:5173/`

---

## 🗄 Структура миграций и функций

- [`supabase/migrations/20260919_init_schema.sql`](./supabase/migrations/20260919_init_schema.sql):
  - Схема таблиц: `profiles`, `tournaments`, `teams`, `team_members`, `matches`.
  - Защита RLS (Row Level Security) на всех таблицах.
  - Защита флага `is_admin` от изменения через API.
  - Атомарная процедура `register_team_atomic` с `FOR UPDATE` (исключает race condition при одновременной регистрации).
  - Генерация олимпийской сетки Single Elimination (`generate_bracket`) со случайным посевом или посевом по Faceit ELO.
- [`supabase/functions/faceit-lookup/index.ts`](./supabase/functions/faceit-lookup/index.ts):
  - Deno Edge Function для безопасного запроса Faceit Data API v4 по SteamID64.
