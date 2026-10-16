import { withErrors, readJson, parseId } from '@/lib/error';
import { validateRequestInput } from '@/lib/validations';
import { getRequest, updateRequest, removeRequest } from '@/lib/requests';

export const GET = withErrors(async (request, { params }) => {
  const id = parseId((await params).id);
  return Response.json({ data: await getRequest(id) });
});

export const PATCH = withErrors(async (request, { params }) => {
  const id = parseId((await params).id);
  const data = validateRequestInput(await readJson(request), { partial: true });
  return Response.json({ data: await updateRequest(id, data) });
});

export const DELETE = withErrors(async (request, { params }) => {
  const id = parseId((await params).id);
  await removeRequest(id);
  return new Response(null, { status: 204 });
});