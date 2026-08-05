import { size, contentType, renderOgImage } from "./og-image-shared";

export const alt = "Outrun — Your AI Growth Partner";
export { size, contentType };

export default function Image() {
  return renderOgImage();
}
