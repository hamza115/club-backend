const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildSort = (sortStr, allowedFields = []) => {
  if (!sortStr) return { createdAt: -1 };

  const [field, order] = sortStr.split(':');
  if (allowedFields.length && !allowedFields.includes(field)) {
    return { createdAt: -1 };
  }

  return { [field]: order === 'asc' ? 1 : -1 };
};

const buildFilter = (query, allowedFields = []) => {
  const filter = {};

  for (const [key, value] of Object.entries(query)) {
    if (!allowedFields.includes(key)) continue;
    if (value === undefined || value === null || value === '') continue;

    if (key === 'search') {
      filter.$or = allowedFields
        .filter((f) => f !== 'search')
        .map((f) => ({ [f]: { $regex: value, $options: 'i' } }));
    } else if (key.endsWith('_from')) {
      const baseKey = key.replace('_from', '');
      if (!filter[baseKey]) filter[baseKey] = {};
      filter[baseKey].$gte = new Date(value);
    } else if (key.endsWith('_to')) {
      const baseKey = key.replace('_to', '');
      if (!filter[baseKey]) filter[baseKey] = {};
      filter[baseKey].$lte = new Date(value);
    } else {
      filter[key] = value;
    }
  }

  return filter;
};

module.exports = { parsePagination, buildSort, buildFilter };