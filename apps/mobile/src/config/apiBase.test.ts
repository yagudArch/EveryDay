import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVELOPMENT_PORT,
  buildOrigin,
  developmentFallbackBaseUrl,
  isLoopbackHost,
  parseApiUrl,
  resolveApiBaseUrl,
} from './apiBase';

describe('parseApiUrl', () => {
  it('разбирает https origin', () => {
    const parsed = parseApiUrl('https://api.everyday.example');
    expect(parsed).not.toBeNull();
    expect(parsed?.protocol).toBe('https');
    expect(parsed?.hostname).toBe('api.everyday.example');
    expect(parsed?.hasPath).toBe(false);
  });

  it('видит path и query', () => {
    expect(parseApiUrl('https://api.everyday.example/api/v1')?.hasPath).toBe(true);
    expect(parseApiUrl('https://api.everyday.example')?.hasPath).toBe(false);
    expect(parseApiUrl('https://api.everyday.example/')?.hasPath).toBe(false);
    expect(parseApiUrl('https://api.everyday.example?a=1')?.hasQueryOrHash).toBe(true);
  });

  it('определяет credentials', () => {
    expect(parseApiUrl('https://user:pass@api.everyday.example')?.hasCredentials).toBe(true);
  });

  it('отклоняет не-http схемы и относительные адреса', () => {
    expect(parseApiUrl('ftp://api.everyday.example')).toBeNull();
    expect(parseApiUrl('api.everyday.example')).toBeNull();
    expect(parseApiUrl('')).toBeNull();
  });

  it('извлекает hostname с портом и IPv6', () => {
    expect(parseApiUrl('http://10.0.2.2:3000')?.hostname).toBe('10.0.2.2');
    expect(parseApiUrl('http://10.0.2.2:3000')?.host).toBe('10.0.2.2:3000');
    expect(parseApiUrl('http://[::1]:3000')?.hostname).toBe('[::1]');
  });
});

describe('isLoopbackHost', () => {
  it('распознаёт localhost, IPv4 loopback и адреса эмулятора', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('10.0.2.2')).toBe(true);
    expect(isLoopbackHost('[::1]')).toBe(true);
  });

  it('не считает loopback внешние хосты', () => {
    expect(isLoopbackHost('api.everyday.example')).toBe(false);
    expect(isLoopbackHost('192.168.1.10')).toBe(false);
  });
});

describe('developmentFallbackBaseUrl', () => {
  it('использует 10.0.2.2 для Android emulator и localhost для остальных', () => {
    expect(developmentFallbackBaseUrl('android')).toBe(`http://10.0.2.2:${DEFAULT_DEVELOPMENT_PORT}`);
    expect(developmentFallbackBaseUrl('ios')).toBe(`http://localhost:${DEFAULT_DEVELOPMENT_PORT}`);
    expect(developmentFallbackBaseUrl('web')).toBe(`http://localhost:${DEFAULT_DEVELOPMENT_PORT}`);
  });
});

describe('resolveApiBaseUrl', () => {
  it('в development без переменной использует fallback и предупреждает', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: undefined, platform: 'android', isDev: true });
    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.source).toBe('development-fallback');
      expect(resolution.baseUrl).toBe('http://10.0.2.2:3000');
      expect(resolution.warnings).toHaveLength(1);
    }
  });

  it('в production без переменной падает явно', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: '   ', platform: 'ios', isDev: false });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe('missing-production-url');
    }
  });

  it('в production требует HTTPS', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: 'http://api.everyday.example', platform: 'ios', isDev: false });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe('insecure-transport');
    }

    const https = resolveApiBaseUrl({ rawUrl: 'https://api.everyday.example', platform: 'ios', isDev: false });
    expect(https.ok).toBe(true);
    if (https.ok) {
      expect(https.baseUrl).toBe('https://api.everyday.example');
      expect(https.warnings).toHaveLength(0);
    }
  });

  it('запрещает HTTP на внешний хост даже в development', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: 'http://192.168.1.10:3000', platform: 'android', isDev: true });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe('insecure-transport');
    }
  });

  it('разрешает HTTP loopback в development', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: 'http://localhost:3000/', platform: 'ios', isDev: true });
    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.baseUrl).toBe('http://localhost:3000');
      expect(resolution.source).toBe('explicit-env');
    }
  });

  it('отклоняет URL с путём', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: 'http://localhost:3000/api/v1', platform: 'ios', isDev: true });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe('path-not-allowed');
    }
  });

  it('отклоняет URL с credentials', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: 'https://u:p@api.everyday.example', platform: 'ios', isDev: false });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe('invalid-url');
    }
  });

  it('предупреждает о loopback backend в production', () => {
    const resolution = resolveApiBaseUrl({ rawUrl: 'https://localhost:8443', platform: 'ios', isDev: false });
    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.warnings).toHaveLength(1);
    }
  });

  // Регрессия: protocol хранится как 'http' | 'https' (без двоеточия), поэтому origin
  // нельзя собирать как `${protocol}//host` — получалось бы 'http//host'.
  it('собирает origin со схемой и разделителем ://', () => {
    const https = resolveApiBaseUrl({ rawUrl: 'https://api.everyday.example', platform: 'ios', isDev: false });
    expect(https.ok).toBe(true);
    if (https.ok) {
      expect(https.baseUrl).toBe('https://api.everyday.example');
      expect(https.baseUrl.startsWith('https://')).toBe(true);
    }

    const http = resolveApiBaseUrl({ rawUrl: 'http://10.0.2.2:3000', platform: 'android', isDev: true });
    expect(http.ok).toBe(true);
    if (http.ok) {
      expect(http.baseUrl).toBe('http://10.0.2.2:3000');
      expect(http.baseUrl).not.toContain('http//');
    }

    const httpsWithPort = resolveApiBaseUrl({ rawUrl: 'https://api.everyday.example:8443', platform: 'web', isDev: false });
    expect(httpsWithPort.ok).toBe(true);
    if (httpsWithPort.ok) {
      expect(httpsWithPort.baseUrl).toBe('https://api.everyday.example:8443');
    }
  });
});

describe('buildOrigin', () => {
  it('не теряет разделитель между схемой и хостом', () => {
    expect(buildOrigin({ protocol: 'https', host: 'api.everyday.example' })).toBe('https://api.everyday.example');
    expect(buildOrigin({ protocol: 'http', host: '10.0.2.2:3000' })).toBe('http://10.0.2.2:3000');
  });

  it('дополняет loopback-fallback корректной схемой', () => {
    expect(developmentFallbackBaseUrl('android')).toBe(`http://10.0.2.2:${DEFAULT_DEVELOPMENT_PORT}`);
    expect(DEFAULT_DEVELOPMENT_PORT).toBe(3000);
  });
});
