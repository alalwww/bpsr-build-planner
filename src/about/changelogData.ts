import raw from './changelog.json';

export interface ChangelogEntry {
  version: string;
  date: string;
  summary: { ja: string; en: string };
  changes: { ja: string[]; en: string[] };
}

export const changelogEntries: ChangelogEntry[] = (raw as { entries: ChangelogEntry[] }).entries;

export const latestChangelogVersion: string | undefined = changelogEntries[0]?.version;
