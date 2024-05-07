import { PageEditorContext } from "@/contexts/PageEditorContext";
import { useContext } from "react";

export const usePageEditor = () => useContext(PageEditorContext);
