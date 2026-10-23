export function parsePort(value) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error('PORT phải là số nguyên từ 1 đến 65535.');
  }

  return Number(value);
}

export function parseClientOrigins(value) {
  const origins = value.split(',').map((origin) => origin.trim()).filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CLIENT_ORIGIN phải chứa ít nhất một địa chỉ Frontend.');
  }

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
        throw new Error();
      }
    } catch {
      throw new Error(`CLIENT_ORIGIN không hợp lệ: ${origin}`);
    }
  }

  return origins;
}
