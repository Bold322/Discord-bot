import { Fragment, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Folder,
  FolderOpen,
  Paperclip,
} from 'lucide-react';
import { AmbientDotField, GradientText, Input, SpotlightCard, cn } from '@app/ui';
import { useAppApi, useBotChatsQuery, useBotFilesQuery } from '@app/query';
import type { BotChat, BotChatStatus } from '@app/api';
import { buildFileTree, type TreeFolder, type TreeNode } from './file-tree';
import { formatBytes, formatDateTime, formatDuration, formatUsd } from './format';

const STATUS: Record<BotChatStatus, { label: string; cls: string }> = {
  pending: { label: 'Хүлээгдэж буй', cls: 'text-amber-300 bg-amber-500/10 ring-amber-400/20' },
  processing: { label: 'Боловсруулж буй', cls: 'text-sky-300 bg-sky-500/10 ring-sky-400/20' },
  answered: { label: 'Хариулсан', cls: 'text-[#C5F135] bg-[#C5F135]/10 ring-[#C5F135]/30' },
  replied: { label: 'Илгээсэн', cls: 'text-[#C5F135] bg-[#C5F135]/10 ring-[#C5F135]/30' },
  failed: { label: 'Алдаа', cls: 'text-rose-300 bg-rose-500/10 ring-rose-400/20' },
};

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

function ChatRow({ chat, open, onToggle }: { chat: BotChat; open: boolean; onToggle: () => void }) {
  const status = STATUS[chat.status] ?? STATUS.pending;
  const reply = chat.status === 'failed' ? chat.error : chat.answer;
  return (
    <Fragment>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-white/5 align-top transition hover:bg-white/[0.03]"
      >
        <td className="px-4 py-3 text-white/40 tabular-nums">
          <span className="inline-flex items-center gap-1">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            {chat.id}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-white/60 tabular-nums">{formatDateTime(chat.createdAt)}</td>
        <td className="whitespace-nowrap px-4 py-3 text-white">{chat.authorName}</td>
        <td className="max-w-[28rem] px-4 py-3">
          <p className={cn('text-white/90', !open && 'line-clamp-1')}>
            {chat.prompt || <span className="text-white/40">(текстгүй, зөвхөн файл)</span>}
          </p>
          {chat.attachments.length > 0 ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
              {chat.attachments.map((a) => (
                <span key={a.name} className="inline-flex items-center gap-1">
                  <Paperclip className="size-3" />
                  {a.name}
                </span>
              ))}
            </p>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs ring-1', status.cls)}>
            {status.label}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-white/60 tabular-nums">
          {formatDuration(chat.durationMs)}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-white tabular-nums">
          {formatUsd(chat.costUsd)}
        </td>
      </tr>
      {open ? (
        <tr className="bg-white/[0.02]">
          <td />
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {chat.status === 'failed' ? 'Алдаа' : 'Хариулт'}
            </p>
            <p className="mt-1 max-w-3xl whitespace-pre-wrap break-words text-sm text-white/80">
              {reply || <span className="text-white/40">Хариулт хараахан алга.</span>}
            </p>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  // Folders above the per-file level start open so the structure is visible at a glance.
  const [open, setOpen] = useState(depth < 2);
  const indent = { paddingLeft: `${depth * 20 + 12}px` };

  if (node.kind === 'file') {
    return (
      <li className="flex items-center gap-2 py-1.5 pr-3 text-sm" style={indent}>
        <FileSpreadsheet className="size-4 shrink-0 text-emerald-300/80" />
        <span className="min-w-0 flex-1 truncate text-white/90">{node.name}</span>
        <span className="shrink-0 text-xs text-white/40 tabular-nums">{formatDateTime(node.lastModified)}</span>
        <span className="w-20 shrink-0 text-right text-xs text-white/60 tabular-nums">{formatBytes(node.size)}</span>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-1.5 pr-3 text-left text-sm transition hover:bg-white/[0.04]"
        style={indent}
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-white/40" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-white/40" />
        )}
        {open ? (
          <FolderOpen className="size-4 shrink-0 text-[#C5F135]/80" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#C5F135]/80" />
        )}
        <span className="shrink-0 font-medium text-white">{node.label}</span>
        {node.hint ? <span className="min-w-0 flex-1 truncate text-white/40">{node.hint}</span> : <span className="flex-1" />}
        <span className="shrink-0 text-xs text-white/40 tabular-nums">{node.fileCount} файл</span>
        <span className="w-20 shrink-0 text-right text-xs text-white/60 tabular-nums">{formatBytes(node.totalSize)}</span>
      </button>
      {open ? (
        <ul>
          {node.children.map((child) => (
            <TreeRow key={child.kind === 'file' ? child.key : child.path} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function FileTree({ root }: { root: TreeFolder }) {
  return (
    <ul className="py-2">
      {root.children.map((child) => (
        <TreeRow key={child.kind === 'file' ? child.key : child.path} node={child} depth={0} />
      ))}
    </ul>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <AlertCircle className="size-8 text-white/20" />
      <p className="text-sm text-white/50">{text}</p>
    </div>
  );
}

/** Public (no login) dashboard for the Discord spreadsheet bot. */
export function BotDashboardPage() {
  const api = useAppApi();
  const chatsQuery = useBotChatsQuery(api);
  const filesQuery = useBotFilesQuery(api);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const allChats = useMemo(() => chatsQuery.data ?? [], [chatsQuery.data]);
  const files = useMemo(() => filesQuery.data ?? [], [filesQuery.data]);

  const chats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allChats;
    return allChats.filter((c) =>
      `${c.prompt} ${c.answer ?? ''} ${c.authorName} ${c.attachments.map((a) => a.name).join(' ')}`
        .toLowerCase()
        .includes(q),
    );
  }, [allChats, search]);

  const stats = useMemo(() => {
    const priced = allChats.filter((c) => c.costUsd != null);
    const total = priced.reduce((sum, c) => sum + (c.costUsd ?? 0), 0);
    return {
      total,
      pricedCount: priced.length,
      average: priced.length ? total / priced.length : null,
      fileBytes: files.reduce((sum, f) => sum + f.size, 0),
    };
  }, [allChats, files]);

  const shownTotal = useMemo(() => chats.reduce((sum, c) => sum + (c.costUsd ?? 0), 0), [chats]);
  const tree = useMemo(() => buildFileTree(files, allChats), [files, allChats]);

  return (
    <div className="relative min-h-screen w-full bg-neutral-950 text-white">
      <AmbientDotField />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
        <header>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
            <Bot className="size-3" />
            Discord bot
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            <GradientText>Spreadsheet</GradientText> туслах
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Discord дээр bot-оос асуусан хүсэлтүүд, хавсаргасан файлууд, хүсэлт бүрийн зардал.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Нийт хүсэлт" value={String(allChats.length)} />
          <StatTile
            label="Нийт зардал"
            value={formatUsd(stats.total)}
            hint={`${stats.pricedCount} хүсэлтэд бүртгэгдсэн`}
          />
          <StatTile label="Дундаж зардал" value={formatUsd(stats.average)} hint="нэг хүсэлтэд" />
          <StatTile label="Файл" value={String(files.length)} hint={formatBytes(stats.fileBytes)} />
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Чатын түүх</h2>
              <p className="text-sm text-white/50">Мөр дээр дарж хариултыг бүтнээр нь харна.</p>
            </div>
            <Input
              placeholder="Хүсэлт, хариулт, хэрэглэгч, файлаар хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full max-w-sm border-white/10 bg-white/[0.03] text-white placeholder:text-white/30 focus-visible:ring-[#C5F135]/40"
            />
          </div>
          <SpotlightCard className="p-0">
            {chatsQuery.isLoading ? (
              <div className="p-8 text-center text-sm text-white/40">Ачааллаж байна...</div>
            ) : chatsQuery.isError ? (
              <EmptyState text="Чатын түүхийг ачаалж чадсангүй." />
            ) : chats.length === 0 ? (
              <EmptyState text={search ? 'Хайлтад тохирох чат алга.' : 'Одоогоор чат алга.'} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Огноо</th>
                      <th className="px-4 py-3 font-semibold">Хэрэглэгч</th>
                      <th className="px-4 py-3 font-semibold">Хүсэлт</th>
                      <th className="px-4 py-3 font-semibold">Төлөв</th>
                      <th className="px-4 py-3 text-right font-semibold">Хугацаа</th>
                      <th className="px-4 py-3 text-right font-semibold">Зардал</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chats.map((chat) => (
                      <ChatRow
                        key={chat.id}
                        chat={chat}
                        open={openId === chat.id}
                        onToggle={() => setOpenId((id) => (id === chat.id ? null : chat.id))}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 text-white/60">
                      <td colSpan={6} className="px-4 py-3 text-right text-xs uppercase tracking-wider">
                        Харагдаж буй {chats.length} хүсэлтийн нийт зардал
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                        {formatUsd(shownTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SpotlightCard>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Файлууд</h2>
            <p className="text-sm text-white/50">
              Bucket дотор хадгалагдсан эх болон зассан файлууд, хүсэлт тус бүрийн хавтсаар.
            </p>
          </div>
          <SpotlightCard className="p-0">
            {filesQuery.isLoading ? (
              <div className="p-8 text-center text-sm text-white/40">Ачааллаж байна...</div>
            ) : filesQuery.isError ? (
              <EmptyState text="Файлын жагсаалтыг ачаалж чадсангүй." />
            ) : files.length === 0 ? (
              <EmptyState text="Одоогоор хадгалсан файл алга." />
            ) : (
              <FileTree root={tree} />
            )}
          </SpotlightCard>
        </section>
      </div>
    </div>
  );
}
