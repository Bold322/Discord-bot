import type { BotChat, BotFile } from '@app/api';

export interface TreeFile {
  kind: 'file';
  name: string;
  key: string;
  size: number;
  lastModified: string;
}

export interface TreeFolder {
  kind: 'folder';
  /** Raw path segment (stable id within the parent). */
  name: string;
  /** Human label; falls back to `name`. */
  label: string;
  /** Extra context shown next to the label (e.g. who asked what). */
  hint?: string;
  path: string;
  children: TreeNode[];
  fileCount: number;
  totalSize: number;
}

export type TreeNode = TreeFolder | TreeFile;

const KIND_LABELS: Record<string, string> = {
  input: 'Эх файл',
  output: 'Зассан файл',
};

/**
 * Turns flat bucket keys (`discord/<channel>/<message>/<input|output>/<file>`)
 * into a folder tree. Message folders are labelled with the chat they belong to
 * when it is known.
 */
export function buildFileTree(files: BotFile[], chats: BotChat[]): TreeFolder {
  const chatByMessage = new Map(chats.map((c) => [c.messageId, c]));
  const root: TreeFolder = { kind: 'folder', name: '', label: 'bucket', path: '', children: [], fileCount: 0, totalSize: 0 };

  for (const file of files) {
    const segments = file.key.split('/').filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) continue;

    let folder = root;
    folder.fileCount += 1;
    folder.totalSize += file.size;
    segments.forEach((segment, depth) => {
      let next = folder.children.find((c): c is TreeFolder => c.kind === 'folder' && c.name === segment);
      if (!next) {
        next = {
          kind: 'folder',
          name: segment,
          label: segment,
          path: `${folder.path}${segment}/`,
          children: [],
          fileCount: 0,
          totalSize: 0,
        };
        // depth 0 = "discord", 1 = channel id, 2 = message id, 3 = input/output
        if (depth === 1) next.label = `Channel ${segment}`;
        if (depth === 2) {
          const chat = chatByMessage.get(segment);
          if (chat) {
            next.label = `#${chat.id} · ${chat.authorName}`;
            next.hint = chat.prompt || '(текстгүй, зөвхөн файл)';
          } else {
            next.label = `Мессеж ${segment}`;
          }
        }
        if (depth === 3) next.label = KIND_LABELS[segment] ?? segment;
        folder.children.push(next);
      }
      next.fileCount += 1;
      next.totalSize += file.size;
      folder = next;
    });
    folder.children.push({ kind: 'file', name: fileName, key: file.key, size: file.size, lastModified: file.lastModified });
  }

  sortTree(root);
  return root;
}

function newestIn(node: TreeNode): string {
  if (node.kind === 'file') return node.lastModified;
  return node.children.reduce((latest, child) => {
    const value = newestIn(child);
    return value > latest ? value : latest;
  }, '');
}

/** Folders first; message folders newest first; `input` before `output`. */
function sortTree(folder: TreeFolder): void {
  for (const child of folder.children) if (child.kind === 'folder') sortTree(child);
  folder.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    if (a.kind === 'folder' && (a.name === 'input' || a.name === 'output')) return a.name.localeCompare(b.name);
    if (a.kind === 'folder') return newestIn(b).localeCompare(newestIn(a));
    return a.name.localeCompare(b.name);
  });
}
