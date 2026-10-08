// Filled in by the auth & quotas step.
export class AuthError extends Error {}
export class QuotaError extends Error {}

export async function authorize(_req: Request, _countedAction: string | null): Promise<void> {}
