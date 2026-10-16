import { withErrors, readJson, parseId } from '@/lib/error';
import { validateNote } from '@/lib/validations';
import { addNote } from '@/lib/requests';

export const POST = withErrors(async (request, { params }) => {
  const id = parseId((await params).id);
  const note = await addNote(id, validateNote(await readJson(request)));
  return Response.json({ data: note }, { status: 201 });
});