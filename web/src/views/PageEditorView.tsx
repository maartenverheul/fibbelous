import { usePageEditor } from "@/hooks";
import {
  BoldItalicUnderlineToggles,
  MDXEditor,
  MDXEditorMethods,
  UndoRedo,
  frontmatterPlugin,
  headingsPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useEffect, useRef } from "react";

export default function PageEditorView() {
  const pageEditor = usePageEditor();

  const markdownRef = useRef<MDXEditorMethods | null>(null);

  useEffect(() => {
    markdownRef.current?.setMarkdown(pageEditor.openPage?.content ?? "");
  }, [pageEditor.openPage]);

  return (
    <div className="PageEditorView markdown">
      <div className="max-w-screen-md mx-auto p-4">
        {pageEditor.openPage && (
          <MDXEditor
            ref={markdownRef}
            markdown={pageEditor.openPage?.content}
            plugins={[
              toolbarPlugin({
                toolbarContents: () => (
                  <>
                    {" "}
                    <UndoRedo />
                    <BoldItalicUnderlineToggles />
                  </>
                ),
              }),
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              frontmatterPlugin(),
            ]}
          />
        )}
      </div>
    </div>
  );
}
