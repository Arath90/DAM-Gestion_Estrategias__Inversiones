const collectDataRes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];
  if (Array.isArray(node.dataRes)) bucket.push(...node.dataRes);
  else if (node.dataRes && typeof node.dataRes === 'object') bucket.push(node.dataRes);
  if (Array.isArray(node.data)) node.data.forEach((entry) => bucket.push(...collectDataRes(entry)));
  return bucket;
};

const normalizeResponse = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.value)) {
    const collected = payload.value.flatMap(collectDataRes);
    return collected.length ? collected : payload.value;
  }
  const collected = collectDataRes(payload);
  if (collected.length) return collected;
  if (Array.isArray(payload)) return payload;
  if (payload.data) return normalizeResponse(payload.data);
  return [payload];
};

export const BASE_PARAMS = { dbServer: 'MongoDB' };

export const keyFor = (id) => `(ID='${encodeURIComponent(id)}')`;

export const unwrapResponse = (payload) => {
  const arr = normalizeResponse(payload);
  return Array.isArray(arr) ? arr : arr ? [arr] : [];
};
