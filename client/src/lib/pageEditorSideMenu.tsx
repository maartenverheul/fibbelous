import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  type SideMenuProps,
  useDictionary,
} from "@blocknote/react";
import { CalloutColorItem } from "./calloutColorItem";

function PageEditorDragHandleMenu() {
  const dict = useDictionary();

  return (
    <DragHandleMenu>
      <RemoveBlockItem>{dict.drag_handle.delete_menuitem}</RemoveBlockItem>
      <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
      <CalloutColorItem>{dict.drag_handle.colors_menuitem}</CalloutColorItem>
      <TableRowHeaderItem>
        {dict.drag_handle.header_row_menuitem}
      </TableRowHeaderItem>
      <TableColumnHeaderItem>
        {dict.drag_handle.header_column_menuitem}
      </TableColumnHeaderItem>
    </DragHandleMenu>
  );
}

export function PageEditorSideMenu(props: SideMenuProps) {
  return <SideMenu {...props} dragHandleMenu={PageEditorDragHandleMenu} />;
}
