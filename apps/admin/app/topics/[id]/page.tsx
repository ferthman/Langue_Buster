import { TopicEditorScreen } from '../../../src/components/TopicEditorScreen';

export default async function TopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TopicEditorScreen topicId={id} />;
}
