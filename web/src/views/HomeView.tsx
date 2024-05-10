import "@mdxeditor/editor/style.css";

export default function HomeView() {
  return (
    <div className="HomeView flex items-center justify-center h-full select-none flex-col gap-3">
      <p className="text-2xl text-gray-300">No page is open</p>
      <p className="text-xl text-gray-300">
        Click on a page in the navigator to view it.
      </p>
    </div>
  );
}
