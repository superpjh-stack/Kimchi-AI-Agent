// A6: 통일된 API 응답 래퍼

export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

/** 성공 응답: { data, meta? } */
export function ok<T>(data: T, meta?: ApiResponse<T>['meta'], status = 200): Response {
  const body: ApiResponse<T> = { data };
  if (meta) body.meta = meta;
  return Response.json(body, { status });
}

/** 성공 응답 (201 Created) */
export function created<T>(data: T): Response {
  return ok(data, undefined, 201);
}

/** 에러 응답: { error: { code, message } } */
export function err(code: string, message: string, status = 400): Response {
  const body: ApiResponse<never> = { error: { code, message } };
  return Response.json(body, { status });
}
