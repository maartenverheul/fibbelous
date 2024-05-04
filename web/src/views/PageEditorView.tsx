import {
  BoldItalicUnderlineToggles,
  MDXEditor,
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

export default function PageEditorView() {
  return (
    <div className="PageEditorView markdown">
      <div className="max-w-screen-md mx-auto p-4">
        <MDXEditor
          markdown={`
          # Hello World
          
          This is paragraph.
          `}
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
