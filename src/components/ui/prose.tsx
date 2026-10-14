/**
 * Typography for rendered markdown / rich text (file previews, FAQ articles,
 * reports). One skin instead of the per-view `[&_h1]:…` strings.
 */
export const PROSE_CLASS =
  "text-sm leading-relaxed text-ink " +
  "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-ink " +
  "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink " +
  "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_a]:text-primary [&_a]:underline " +
  "[&_code]:rounded [&_code]:bg-selected [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-ink " +
  "[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-8 [&_pre]:bg-sub-bg [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-muted " +
  "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 " +
  "[&_hr]:my-4 [&_hr]:border-line [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-8";

export default function Prose({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${PROSE_CLASS} ${className}`}>{children}</div>;
}
