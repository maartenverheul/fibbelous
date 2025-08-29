import { TOCItem } from "@/models";
import { createContext, useContext, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export type TOCContextType = {
  toc: TOCItem[];
  loadTOC: (parent?: string) => Promise<void>;
};

const TOCCOntext = createContext<TOCContextType | undefined>(undefined);

export function TOCProvider({ children }: { children: React.ReactNode }) {

  const [toc, setTOC] = useState<TOCItem[]>([
    {
      id: "1",
      title: "Test",
      icon: "📄",
      children: [
        {
          id: "2",
          title: "Test 2",
          icon: "📄",
          children: [
            {
              id: "3",
              title: "Test 3",
              icon: "📄",
              children: []
            }
          ]
        }
      ]
    }
  ]);

  async function loadTOC(parent?: string) {
    return invoke("load_toc", { parent })
      .then((newTOC) => {
        setTOC(newTOC as TOCItem[]);
      })
      .catch((error) => {
        console.error("Failed to load TOC:", error);
      });
  }

  return <TOCCOntext.Provider value={{
    toc,
    loadTOC
  }}>{children}</TOCCOntext.Provider>;
}

export function useTOCContext() {
  const ctx = useContext(TOCCOntext);
  if (!ctx)
    throw new Error("useTOCContext must be used within a TOCProvider");
  return ctx;
}
