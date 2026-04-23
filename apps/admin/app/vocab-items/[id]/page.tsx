import { VocabEditorScreen } from '../../../src/components/VocabEditorScreen';

export default async function VocabItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VocabEditorScreen vocabItemId={id} />;
}
