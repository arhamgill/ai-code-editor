import { redirect } from "next/navigation";

/**
 * The workspace used to live at /editor?projectId=… with the project list
 * rendered by the same component. Both now have real routes, so old links and
 * bookmarks are forwarded rather than 404ing.
 */
export default async function LegacyEditorRedirect({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  redirect(projectId ? `/projects/${projectId}` : "/projects");
}
