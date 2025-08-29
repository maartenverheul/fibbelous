import { Page } from "@/models";
import { RotateCcw, XCircle } from "lucide-react";
import TopBar from "./topBar";

type Props = {
  page: Page;
};

export default function PageViewer({ page }: Props) {
  function removeCover() { }

  function changeCover() { }

  function changeTitle(newTitle: string) {
    // Update the page title
    console.log(newTitle);
  }

  return (
    <div className="PageViewer bg-gray-900 h-full flex flex-col">
      <TopBar />
      <div className="PageViewer bg-gray-900 h-full overflow-y-auto">
        <div
          className="PageCover w-full bg-center bg-cover relative group"
          style={{
            backgroundImage: page.cover ? `url(${page.cover})` : undefined,
            height: page.cover ? "300px" : "100px",
          }}
        >
          {page.cover && (
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
          {page.icon && (
            <button className="Icon select-none w-24 h-24 text-7xl absolute left-0 top-0 -translate-y-1/2 transition hover:bg-white/20 flex justify-center items-center cursor-pointer rounded">
              {page.icon}
            </button>
          )}

          <input
            type="text"
            className="text-white focus:outline-0 text-5xl font-bold placeholder:text-gray-600 w-full"
            placeholder="No title"
            value={page.title}
            onChange={(e) => changeTitle(e.target.value)}
          />
        </div>
        <div className="PageContent w-full max-w-[1000px] mx-auto p-4">
          <textarea
            name="content"
            className="w-full border border-gray-600 rounded focus:outline-none text-white font-mono"
          ></textarea>
        </div>
      </div>
    </div>
  );
}
