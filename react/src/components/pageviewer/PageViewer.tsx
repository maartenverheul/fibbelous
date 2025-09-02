import { RotateCcw, XCircle } from "lucide-react";
import TopBar from "./TopBar";
import { usePage } from "@/contexts/PageContext";
import PageNotFound from "./PageNotFound";

export default function PageViewer() {
  const page = usePage();

  function removeCover() {}

  function changeCover() {}

  function changeTitle(newTitle: string) {
    // Update the page title
    console.log(newTitle);
  }

  if (!page.loaded) return <p>Loading...</p>;
  if (!page.data) return <PageNotFound />;

  return (
    <div className="PageViewer bg-gray-900 h-full flex flex-col">
      <TopBar />
      <div className="PageViewer bg-gray-900 h-full overflow-y-auto">
        <div
          className="PageCover w-full bg-center bg-cover relative group"
          style={{
            backgroundImage: page.data.cover
              ? `url(${page.data.cover})`
              : undefined,
            height: page.data.cover ? "300px" : "100px",
          }}
        >
          {page.data.cover && (
            <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition delay-100">
              <button
                className="items-center gap-2 cursor-pointer select-none text-black/40 text-sm hover:bg-black/40 hover:text-white px-2 flex rounded"
                onClick={removeCover}
              >
                <XCircle className="w-4" /> Remove
              </button>
              <button
                className="items-center gap-2 cursor-pointer select-none text-black/40 text-sm hover:bg-black/40 hover:text-white px-2 flex rounded"
                onClick={changeCover}
              >
                <RotateCcw className="w-4" /> Change
              </button>
            </div>
          )}
        </div>
        <div className="PageHeader w-full max-w-[1000px] mx-auto p-4 relative pt-12">
          {page.data.icon && (
            <button className="Icon select-none w-24 h-24 text-7xl absolute left-0 top-0 -translate-y-1/2 transition hover:bg-white/20 flex justify-center items-center cursor-pointer rounded">
              {page.data.icon}
            </button>
          )}

          <input
            type="text"
            className="text-white focus:outline-0 text-5xl font-bold placeholder:text-gray-600 w-full"
            placeholder="No title"
            value={page.data.title}
            onChange={(e) => changeTitle(e.target.value)}
          />
        </div>
        <div className="PageContent w-full max-w-[1000px] mx-auto p-4">
          <textarea
            name="content"
            className="w-full border min-h-[300px] border-gray-600 rounded focus:outline-none text-white font-mono"
            value={page.content}
            onChange={() => {
              console.warn("TODO content change");
            }}
          ></textarea>
        </div>
      </div>
    </div>
  );
}
