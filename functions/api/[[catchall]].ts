import { handleApiRequest, type Env } from '../../src/worker/cf-api';

interface EventContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

export async function onRequest(context: EventContext): Promise<Response> {
  return handleApiRequest(context.request, context.env);
}
