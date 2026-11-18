# Discord-bot

Way project-ийн monorepo: Discord bot, түүний dashboard-тай frontend, backend болон судалгааны тэмдэглэл.

| Хавтас | Юу вэ |
|---|---|
| `discord-claude-bridge/` | Discord bot (Railway) + Claude Code bridge (Mac). Чат хадгалах, mention болон дуут зурваст Claude-аар хариулах, дуут зурвас ⇄ текст (ElevenLabs). Дэлгэрэнгүйг дотор нь байгаа README-ээс үзнэ. |
| `Way-project-front/` | Nx monorepo: `client` (нийтэд нээлттэй `/bot` dashboard-тай) ба `super-admin` апп. |
| `Way-project-back/` | Go API сервер (нэвтрэлт, tenant, урилга). |
| `notes/`, `reports/`, `research_notes/` | Төлөвлөгөө, судалгааны тэмдэглэл. |

Нууц түлхүүрүүд repo-д ордоггүй: хавтас бүрийн `.env.example`-ийг `.env` болгон хуулж бөглөнө.
