export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function uploadMedia(file: File, fields: Record<string, string>) {
  const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!csrf.ok) throw new ApiError(csrf.status, 'Unable to prepare the upload.');
  const { token } = await csrf.json();
  const data = new FormData();
  data.append('file', file);
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  const response = await fetch('/api/v1/admin/media', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRF-TOKEN': token },
    body: data,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.title ?? 'Unable to upload this file.');
  }
  return response.json();
}
export async function clientApi<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  version?: number,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const csrfResponse = await fetch('/api/v1/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!csrfResponse.ok) throw new ApiError(csrfResponse.status, 'Unable to prepare this form.');
    const { token } = await csrfResponse.json();
    headers['X-CSRF-TOKEN'] = token;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  const response = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const validation = error.errors ? Object.values(error.errors).flat().join('\n') : '';
    throw new ApiError(
      response.status,
      validation || error.title || `Request failed (${response.status})`,
    );
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
