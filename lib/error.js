export class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  
  export const validationError = (details) =>
    new ApiError(422, 'VALIDATION_ERROR', 'Some fields are invalid', details);
  export const notFound = (what = 'Return request') =>
    new ApiError(404, 'NOT_FOUND', `${what} not found`);
  
  export function errorResponse(err) {
    if (err instanceof ApiError) {
      return Response.json(
        { error: { code: err.code, message: err.message, details: err.details ?? null } },
        { status: err.status }
      );
    }
    if (err.code === '23505' && err.constraint === 'one_live_request_per_item') {
      return errorResponse(new ApiError(409, 'DUPLICATE_LIVE_REQUEST',
        'This order and item already have a live return request'));
    }
    if (err.code === '23514') {
      return errorResponse(new ApiError(422, 'CONSTRAINT_VIOLATION',
        `Data breaks rule: ${err.constraint}`));
    }
    console.error(err);
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', details: null } },
      { status: 500 }
    );
  }
  
  export const withErrors = (handler) => async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
  
  export async function readJson(request) {
    try {
      return await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }
  }
  
  export function parseId(raw) {
    if (!/^\d{1,15}$/.test(raw)) throw notFound();
    return raw;
  }