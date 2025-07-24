export function filterBase64FromResponse(data: any): any {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => filterBase64FromResponse(item));
  }

  if (typeof data === "object") {
    const filtered: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        if (value.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(value.substring(0, 100))) {
          filtered[key] = `[BASE64_DATA_FILTERED - ${value.length} chars]`;
        } else {
          filtered[key] = value;
        }
      } else {
        filtered[key] = filterBase64FromResponse(value);
      }
    }

    return filtered;
  }

  return data;
}
