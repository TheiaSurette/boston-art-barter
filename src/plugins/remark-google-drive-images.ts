import { visit } from "unist-util-visit";
import type { Root } from "mdast";

const DRIVE_ID_PATTERN = /^[\w-]+$/;

export function remarkGoogleDriveImages() {
  return (tree: Root) => {
    visit(tree, "image", (node) => {
      if (DRIVE_ID_PATTERN.test(node.url) && !node.url.includes("/")) {
        node.url = `https://drive.google.com/thumbnail?id=${node.url}&sz=w800`;
      }
    });
  };
}
