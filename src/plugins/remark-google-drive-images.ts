import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import { DRIVE_ID_PATTERN, driveImageUrl } from "../lib/drive";

export function remarkGoogleDriveImages() {
  return (tree: Root) => {
    visit(tree, "image", (node) => {
      if (DRIVE_ID_PATTERN.test(node.url) && !node.url.includes("/")) {
        node.url = driveImageUrl(node.url);
      }
    });
  };
}
