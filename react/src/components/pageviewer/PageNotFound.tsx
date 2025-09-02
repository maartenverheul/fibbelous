import { useAppNavigation } from "@/contexts/AppNavigationContext";
import { TOCItem } from "@/models";
import { FileText } from "lucide-react";
import { Link } from "react-router";

type Props = {
  page?: TOCItem;
};

export default function PageNotFound({ page }: Props) {
  const appNavigation = useAppNavigation();
  const title = page ? `Page "${page.title}" not found.` : "Page not found.";

  return (
    <div className="w-full h-full items-center justify-center bg-gray-900 text-gray-500 flex flex-col">
      <FileText className="w-24 h-24" />
      <h1 className="text-4xl font-bold my-10">{title}</h1>
      <Link
        to={appNavigation.workspaceHomeLink()}
        className="bg-blue-600 cursor-pointer hover:bg-blue-700 text-white px-4 py-1 rounded"
      >
        Return to home
      </Link>
    </div>
  );
}
