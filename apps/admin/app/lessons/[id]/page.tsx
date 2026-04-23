import { LessonEditorScreen } from '../../../src/components/LessonEditorScreen';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LessonEditorScreen lessonId={id} />;
}
