import TopBar from "@/components/PageEditor/TopBar";
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
import { useEffect, useRef, useState } from "react";
import create from "textdiff-create";
import { useThrottledCallback } from "use-debounce";

export default function PageEditorView() {
  const pageEditor = usePageEditor();

  const markdownRef = useRef<MDXEditorMethods | null>(null);

  const [oldContent, setOldContent] = useState(pageEditor.openPage!.content);

  const updateChanges = useThrottledCallback((newContent: string) => {
    const changes = create(oldContent, newContent);
    setOldContent(newContent);
    pageEditor.makeChange(changes);
  }, 1000);

  useEffect(() => {
    markdownRef.current?.setMarkdown(pageEditor.openPage?.content ?? "");
  }, [pageEditor.openPage]);

  function change(newContent: string) {
    updateChanges(newContent);
  }

  if (!pageEditor.openPage) return "";

  return (
    <div className="PageEditorView">
      <TopBar />
      <div className="max-w-screen-md mx-auto p-4 markdown">
        <MDXEditor
          ref={markdownRef}
          markdown={oldContent}
          onChange={change}
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
      </div>
    </div>
  );
}
