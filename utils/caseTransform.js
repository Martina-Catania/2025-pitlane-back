function normalizeResponseKey(key) {
  return key
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/ID\b/g, 'Id')
    .replace(/URL\b/g, 'Url')
    .replace(/^([A-Z])/, (c) => c.toLowerCase());
}

function toCamelCaseDeep(value) {
  if (Array.isArray(value)) {
    return value.map(toCamelCaseDeep);
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      acc[normalizeResponseKey(key)] = toCamelCaseDeep(nestedValue);
      return acc;
    }, {});
  }

  return value;
}

module.exports = {
  normalizeResponseKey,
  toCamelCaseDeep
};