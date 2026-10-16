import { withErrors, readJson } from '@/lib/error';
import { validateListQuery, validateRequestInput } from '@/lib/validations';
import { listRequests, createRequest } from '@/lib/requests';

export const GET = withErrors(async (request) => {
  const params = validateListQuery(new URL(request.url).searchParams);
  return Response.json(await listRequests(params));
});

export const POST = withErrors(async (request) => {
  const data = validateRequestInput(await readJson(request));
  const created = await createRequest(data);
  return Response.json({ data: created }, { status: 201 });
});