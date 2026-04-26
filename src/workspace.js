import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  '.codex',
  '.git',
  '.multiverse-sec',
  '.omx',
  'node_modules'
]);

function isTextBuffer(buffer) {
  return !buffer.includes(0);
}

function normalizeRelativePath(filePath) {
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`워크스페이스 밖 경로는 허용되지 않습니다: ${filePath}`);
  }
  return normalized;
}

function walkWorkspace(rootDir, currentDir, files, options) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= options.maxFiles) break;
    if (entry.name.startsWith('.DS_Store')) continue;

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walkWorkspace(rootDir, absolutePath, files, options);
      continue;
    }

    if (!entry.isFile()) continue;

    const buffer = fs.readFileSync(absolutePath);
    if (!isTextBuffer(buffer)) continue;

    const content = buffer.toString('utf8');
    if (content.length > options.maxFileChars) continue;
    if (options.totalChars + content.length > options.maxTotalChars) continue;

    files.push({ path: relativePath, content });
    options.totalChars += content.length;
  }
}

export function buildWorkspaceSnapshot(rootDir, options = {}) {
  const limits = {
    maxFiles: options.maxFiles ?? 24,
    maxFileChars: options.maxFileChars ?? 12000,
    maxTotalChars: options.maxTotalChars ?? 50000,
    totalChars: 0
  };
  const files = [];
  walkWorkspace(rootDir, rootDir, files, limits);
  return {
    rootDir,
    fileCount: files.length,
    files
  };
}

export function applyWorkspaceChanges(rootDir, changes) {
  const changedPaths = [];
  for (const change of changes) {
    const relativePath = normalizeRelativePath(change.path);
    const absolutePath = path.join(rootDir, relativePath);

    if (change.action === 'delete') {
      if (fs.existsSync(absolutePath)) {
        const stats = fs.lstatSync(absolutePath);
        if (stats.isDirectory()) {
          throw new Error(`디렉터리 삭제는 지원하지 않습니다: ${relativePath}`);
        }
        fs.unlinkSync(absolutePath);
        changedPaths.push(relativePath);
      }
      continue;
    }

    if (change.action !== 'create' && change.action !== 'replace') {
      throw new Error(`지원하지 않는 파일 변경 액션입니다: ${change.action}`);
    }

    if (typeof change.content !== 'string') {
      throw new Error(`파일 내용이 비어 있습니다: ${relativePath}`);
    }

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, change.content, 'utf8');
    changedPaths.push(relativePath);
  }
  return changedPaths;
}

export function describeWorkspacePath(rootDir, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.join(rootDir, normalized);
  if (!fs.existsSync(absolutePath)) {
    return {
      path: normalized,
      exists: false,
      kind: 'missing'
    };
  }

  const stats = fs.lstatSync(absolutePath);
  return {
    path: normalized,
    exists: true,
    kind: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other'
  };
}
