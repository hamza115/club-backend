class AppResponse {
  static success(res, { data = null, message = 'Success', statusCode = 200, meta = null }) {
    const body = { success: true, message };
    if (data !== null) body.data = data;
    if (meta !== null) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static created(res, { data = null, message = 'Created successfully' }) {
    return this.success(res, { data, message, statusCode: 201 });
  }

  static paginated(res, { data, pagination, message = 'Success', meta = null }) {
    const paginationMeta = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    };
    return this.success(res, {
      data,
      message,
      meta: meta ? { ...paginationMeta, ...meta } : paginationMeta,
    });
  }

  static error(res, { message = 'Internal Server Error', statusCode = 500, errors = null }) {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }
}

module.exports = AppResponse;