import type { Action } from "svelte/action";

export const link: Action<HTMLAnchorElement> = (node) => {
  const href = node.href;

  node.addEventListener("click", (event) => {
    event.preventDefault();

    history.pushState({}, "", href);
  });
};
