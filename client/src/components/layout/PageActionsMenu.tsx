import { useTabs, type TabTarget } from "../../context/TabContext";
import { cn } from "../../lib/utils";
import type { WorkspacePage } from "../../types/page";

const menuItemClassName = cn(
  "w-full px-3 py-1.5 text-left text-sm text-stone-800",
  "hover:bg-stone-200/80 dark:text-stone-200 dark:hover:bg-stone-800",
);

type PageActionsMenuProps = {
  segment: string;
  target: TabTarget;
  page?: WorkspacePage;
  onClose: () => void;
  onCreateSubpage?: () => void;
  onDuplicate?: () => void;
  onToggleFavorite?: () => void;
  onTrash?: () => void;
};

export function PageActionsMenu({
  segment,
  target,
  page,
  onClose,
  onCreateSubpage,
  onDuplicate,
  onToggleFavorite,
  onTrash,
}: PageActionsMenuProps) {
  const { openTabInNew, isTabOpen } = useTabs();
  const canOpenInNewTab = !isTabOpen(segment, target.pageId);
  const isFavorite = Boolean(page?.favorite);

  return (
    <>
      {canOpenInNewTab && (
        <button
          type="button"
          className={menuItemClassName}
          onClick={() => {
            openTabInNew(segment, target);
            onClose();
          }}
        >
          Open in new tab
        </button>
      )}
      {page && (
        <>
          {canOpenInNewTab && (
            <div className="my-1 h-px bg-[var(--app-border)]" role="separator" />
          )}
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => {
              onCreateSubpage?.();
              onClose();
            }}
          >
            Create subpage
          </button>
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => {
              onDuplicate?.();
              onClose();
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => {
              onToggleFavorite?.();
              onClose();
            }}
          >
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </button>
          <div className="my-1 h-px bg-[var(--app-border)]" role="separator" />
          <button
            type="button"
            className={cn(
              menuItemClassName,
              "text-red-700 dark:text-red-400",
            )}
            onClick={() => {
              onTrash?.();
              onClose();
            }}
          >
            Move to trash
          </button>
        </>
      )}
    </>
  );
}
