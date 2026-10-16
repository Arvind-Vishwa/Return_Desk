import { withErrors, readJson, parseId } from '@/lib/error';
import { validateStatusChange } from '@/lib/validations';
import { changeStatus } from '@/lib/requests';

export const POST = withErrors(async (request, { params }) => {
  const id = parseId((await params).id);
  const change = validateStatusChange(await readJson(request));
  return Response.json({ data: await changeStatus(id, change) });
});