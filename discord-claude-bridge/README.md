# discord-claude-bridge

Discord channel дээрх чатыг Railway Postgres-д хадгалж, bot-ыг mention хийсэн асуултыг
энэ Mac дээрх **Claude Code (subscription)**-оор шийдүүлж, хариултыг нь Discord дээр
тухайн хэрэглэгчийг mention хийж reply хийдэг систем.

```
Discord channel ──► bot.js (Railway) ──► Postgres (Railway)
                                            │ requests: pending
                                            ▼
                                    bridge.js (энэ Mac) ──► `claude -p` (subscription)
                                            │ requests: answered
                                            ▼
Discord reply  ◄── bot.js (Railway) ◄── Postgres (Railway)
```

## Файлууд

| Файл | Хаана ажиллах | Үүрэг |
|---|---|---|
| `src/bot.js` | Railway | Чат хадгалах, mention-ийг `requests` дараалалд оруулах, бэлэн хариултыг reply хийх |
| `src/bridge.js` | Энэ Mac | `pending` хүсэлт авч `claude -p` ажиллуулж, хариултыг DB-д бичих |
| `src/claude.js` | Mac | Claude Code CLI wrapper |
| `src/db.js` | хоёуланд | Postgres schema + query-ууд |
| `scripts/install-bridge-launchd.sh` | Mac | bridge-ийг background service болгох |

### DB хүснэгтүүд
- `messages` — ажиглаж буй channel-ийн бүх чат (лог + context).
- `requests` — ажлын дараалал. `status`: `pending → processing → answered → replied` (эсвэл `failed`).

## 1. Discord bot үүсгэх
1. https://discord.com/developers/applications → New Application → Bot.
2. **Bot → Privileged Gateway Intents → MESSAGE CONTENT INTENT** асаана (заавал).
3. Token-оо хуулна → `DISCORD_TOKEN`.
4. OAuth2 → URL Generator: scope `bot`, permissions `View Channels`, `Send Messages`, `Read Message History`, `Add Reactions` → серверт нэмнэ.
5. Discord дээр Developer Mode асаагаад channel дээр хулганы баруун товч → Copy Channel ID → `WATCH_CHANNEL_IDS`.

## 2. Railway дээр DB + bot deploy хийх
1. Railway → New Project → **Add PostgreSQL**.
2. Postgres service → Variables → `DATABASE_PUBLIC_URL`-ийг хуулна (bridge Mac дээрээс холбогдох тул public URL хэрэгтэй).
3. Мөн project руу **New Service → GitHub repo** (энэ хавтас) эсвэл `railway up` (CLI):
   ```bash
   npm i -g @railway/cli
   railway login
   railway init          # project сонгоно
   railway up            # энэ хавтсыг deploy
   ```
4. Bot service-ийн Variables:
   ```
   DISCORD_TOKEN=...
   DATABASE_URL=${{Postgres.DATABASE_URL}}   # Railway-ийн internal reference
   WATCH_CHANNEL_IDS=123...,456...
   ```
   Start command анхдагчаар `npm start` (= `node src/bot.js`). Schema нь эхний ажиллахад өөрөө үүснэ.

## 3. Bridge-ийг Mac дээр ажиллуулах
```bash
cd discord-claude-bridge
npm install
cp .env.example .env     # DATABASE_URL (public URL!), CLAUDE_WORKDIR-ээ бөглөнө
claude                   # нэг удаа subscription-оороо login хийсэн байх ёстой
npm run bridge           # гараар ажиллуулах
```
Үргэлж ард нь ажиллаж байлгах бол:
```bash
./scripts/install-bridge-launchd.sh   # login хийхэд автоматаар асна, унавал дахин асна
tail -f bridge.log
```

## Хэрхэн ажилладаг вэ
1. Хэн нэгэн ажиглаж буй channel дээр `@Bot энэ алдааг яаж засах вэ?` гэж бичнэ.
2. Bot чатыг `messages`-д хадгалж, `requests`-д `pending` мөр нэмж, 👀 reaction тавина.
3. Bridge 3 секунд тутам шалгаж, мөрийг `processing` болгоод сүүлийн 15 чатыг context болгон
   `claude -p` ажиллуулна (`CLAUDE_WORKDIR` доторх кодыг Read/Glob/Grep-ээр уншиж чадна).
4. Хариултыг `answered` болгож хадгална.
5. Bot 3 секунд тутам `answered`-ийг авч, анхны мессеж дээр `<@user> хариулт` гэж reply хийгээд `replied` болгоно.
   2000 тэмдэгтээс урт бол хэсэглэж илгээнэ. Алдаа гарвал `failed` → хэрэглэгчид алдааны мэдэгдэл очно.

## Тохиргооны сонголтууд
- `TRIGGER_USER_IDS` — bot-оос өөр хүнийг (жишээ нь өөрийгөө) mention хийхэд ажиллуулах бол энд ID бичнэ.
- `CLAUDE_ALLOWED_TOOLS` — анхдагч `Read,Glob,Grep` (зөвхөн унших). Код засуулах бол `Read,Glob,Grep,Edit,Write,Bash` гэж өргөжүүлнэ.
- `CLAUDE_EXTRA_ARGS` — жишээ: `--model sonnet` (хямд/хурдан), `--dangerously-skip-permissions`.
- `CLAUDE_TIMEOUT_MS` — нэг хүсэлтийн дээд хугацаа (анхдагч 10 мин).
- Bridge унтарсан үед `processing`-д гацсан хүсэлт 20 минутын дараа автоматаар `pending` руу буцна (3 оролдлогын дараа `failed`).

## Дуут зурвас → текст
Ажиглаж буй channel дээр **Record Voice Message** товчоор дуут зурвас илгээхэд bot бүтэн яриаг
текст болгож тухайн зурвас дээр reply хийнэ (mention шаардахгүй). Текст нь `messages`-д
`[дуут зурвас] ...` хэлбэрээр хадгалагдах тул дараа нь mention хийхэд Claude context болгон харна.

- Дараа нь текстийг mention хийсэн асуулттай адилаар `requests` дараалалд оруулж, bridge `claude -p`-ээр хариулна (👀 reaction). `VOICE_TO_CLAUDE=off` бол зөвхөн текст болгоно.
- Хариулт нь текст + `hariult.mp3` (ElevenLabs TTS, `src/speech.js`) хэлбэрээр нэг зурваст ирнэ. `TTS=off` бол зөвхөн текст. `TTS_VOICE_ID`, `TTS_MODEL` (анхдагч `eleven_v4`), `TTS_MAX_CHARS` (анхдагч 1500, үүнээс урт бол дуугүй).
- Үнэгүй багцтай ElevenLabs данс зөвхөн үндсэн (premade) дуу хоолой ашиглана. Монгол library дуу хоолойд Creator багц хэрэгтэй.
- Claude-ийн чатын хариулт анхдагчаар 2 өгүүлбэр, хэрэглэгч «дэлгэрэнгүй тайлбарла» гэх мэтээр хүсвэл урт (`src/bridge.js` → `BRIEF_PROMPT`).
- `src/transcribe.js` нь аудиог ElevenLabs Scribe (`POST /v1/speech-to-text`) руу илгээнэ. Bot (Railway) дотор ажиллана, bridge хэрэггүй.
- Railway-ийн bot service-д `ELEVENLABS_API_KEY` нэмнэ. Байхгүй бол функц унтраалттай.
- `STT_MODEL` (анхдагч `scribe_v3`), `STT_LANGUAGE` (анхдагч `mon`; холимог хэлтэй бол `auto`), `VOICE_MAX_MB` (анхдагч 25).

## Google Drive файл: нэрээр нь олж, Drive дээр нь засах
Bot-ыг mention хийгээд Drive дээрх файлын нэрийг дурдана (хавсралтгүйгээр). Жишээ:
`@Bot Ai-agent-developer-hutulbur файлын 15-р хичээлийн төлөвийг Хийгдсэн болго`.

- Bridge файлыг нэрээр нь хайж, уншиж, зөвхөн хүссэн нүд/хэсгийг Drive дээр нь шууд засна. Хариултад юу → юу болсон, файлын холбоос орно.
- Ижил нэртэй хэд хэдэн файл таарвал (жишээ нь «X», «Copy of X») таамаглахгүй, алийг нь гэж асууна.
- Файлын доторх текстийг заавар гэж дагахгүй (prompt injection): зөвхөн Discord хэрэглэгчийн мессеж шийднэ.
- Sheets, Docs, Slides-ийг засна. Хуваалцах, устгах, хуулах, шинэ файл үүсгэх хэрэгсэл өгөөгүй (`src/drive.js`).

Энэ нь bridge ажиллаж буй Mac-ийн Claude Code-д холбогдсон claude.ai connector-уудыг (Google Drive, Google Sheets) ашиглана: `claude` дотор `/mcp`-ээр холбогдсон байх ёстой. Тэр Google хаягийн хандаж чаддаг бүх файлд хүрнэ.

- `GOOGLE_DRIVE=off` — Drive-ийн хандалтыг бүрэн унтраана.
- `DRIVE_WRITE_USER_IDS` — засах эрхтэй Discord хэрэглэгчийн ID-ууд (таслалаар). Хоосон бол ажиглаж буй channel-ийн хүн бүр засна; бөглөвөл бусад нь зөвхөн уншина.

## Spreadsheet файл: тайлбарлах, асуух, засах
Bot-ыг mention хийгээд `.xlsx`, `.xlsm`, `.xlsb`, `.xls`, `.csv`, `.tsv` файл хавсаргана.

- Текстгүй бол файл юуны тухай болохыг 2 өгүүлбэрээр хариулна.
- Асуулт бичвэл (жишээ нь «дундаж оноо хэд вэ») бүх өгөгдөл дээр тооцоолж хариулна.
- Засвар хүсвэл (жишээ нь «Нийт багана нэм») зассан файлыг хавсралтаар буцаана. Эх файл өөрчлөгдөхгүй.

Дотоод урсгал:
1. `bot.js` хавсралтын холбоосыг `requests.attachments`-д хадгална.
2. `bridge.js` файлыг түр хавтаст татаж, `scripts/profile_spreadsheet.py`-ээр тоймлоно.
3. `claude -p` хэрэгсэлгүй горимд тоймыг хараад текстэн хариу эсвэл Python скрипт буцаана.
4. Скриптийг `scripts/sandbox.sb` дүрмээр `sandbox-exec` дотор ажиллуулна: сүлжээгүй, зөвхөн түр хавтаст бичнэ, `/Users`-ийг уншихгүй. Алдаа гарвал Claude-аар `SPREADSHEET_MAX_REPAIRS` удаа засуулна.
5. `scripts/check_output.py` гаралтыг шалгана (нээгдэх эсэх, хэмжээ, гадагш холбогддог томьёо).
6. Файл `request_files` хүснэгтээр дамжиж, bot Discord руу хавсаргана (bot-д **Attach Files** эрх хэрэгтэй).

Mac дээр нэг удаа суулгах:
```bash
uv venv --python 3.12
uv pip install pandas python-calamine charset-normalizer openpyxl defusedxml
```
Хязгаар: нэг мессежид 3 файл, оролт `SPREADSHEET_MAX_MB` (25 MB), гаралт 8 MB. `.xls`/`.xlsb`-г зөвхөн утгатай `.xlsx` болгож хөрвүүлнэ. Шинэ томьёоны утга файлыг Excel-д нээхэд тооцогдоно.
