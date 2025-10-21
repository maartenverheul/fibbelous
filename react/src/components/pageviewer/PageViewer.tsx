import TopBar from "./TopBar";
import { usePage } from "@/contexts/PageContext";
import PageNotFound from "./PageNotFound";
import PageHeader from "./PageHeader";

export default function PageViewer() {
  const pageContext = usePage();

  if (!pageContext.loaded) return <p>Loading...</p>;
  if (!pageContext.data) return <PageNotFound />;

  return (
    <div className="PageViewer bg-gray-900 h-full flex flex-col">
      <TopBar />
      <div className="PageViewer bg-gray-900 h-full overflow-y-auto">
        <PageHeader
          page={pageContext.data}
          // onChangeCover={(remove) => pageContext.updateCover(remove)}
          onTitleChange={(title) => pageContext.updateTitle(title)}
          onIconChange={(icon) => pageContext.updateIcon(icon)}
        />
        <div className="PageContent w-full max-w-[1000px] mx-auto p-4">
          <textarea
            name="content"
            className="w-full border min-h-[300px] border-gray-600 rounded focus:outline-none text-white font-mono"
            value={pageContext.content}
            onChange={(e) => pageContext.updateContent(e.target.value)}
          ></textarea>
        </div>
      </div>
    </div>
  );
}
