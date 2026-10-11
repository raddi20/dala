import { renderEditedBlob, type Surface } from "./photo-bitmap";
import type { PhotoEdit, Size } from "./photo-edit";

type Request = {
  bitmap: ImageBitmap;
  source: Size;
  edit: PhotoEdit;
  canWebp: boolean;
};

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (data: unknown) => void;
};

scope.onmessage = (event) => {
  const { bitmap, source, edit, canWebp } = event.data;
  void renderEditedBlob({
    bitmap,
    source,
    edit,
    canWebp,
    createSurface: (width, height) => new OffscreenCanvas(width, height) as Surface,
  })
    .then((blob) => {
      bitmap.close?.();
      scope.postMessage({ blob });
    })
    .catch((error: unknown) => {
      bitmap.close?.();
      scope.postMessage({
        error: error instanceof Error ? error.message : "Could not prepare that photo on this device.",
      });
    });
};
