export interface SupportedLanguage {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en_US', label: 'English' },
  { code: 'ja_JP', label: '日本語' },
  { code: 'ko_KR', label: '한국어' },
  { code: 'zh_CN', label: '简体中文' },
  { code: 'zh_TW', label: '繁體中文' },
];
