import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Shared by opengraph-image.tsx and twitter-image.tsx so the two file-system
// conventions (Next.js requires one default-exported generator per file)
// render the exact same card instead of two hand-maintained copies. Colors
// match src/app/globals.css's real design tokens, not the placeholder blue
// used in ad creative — this renders inside the actual product's metadata.
export function renderOgImage() {
  const logoDataUrl = `data:image/png;base64,${readFileSync(
    join(process.cwd(), "public", "logo-mark.png"),
  ).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#181818",
          gap: 28,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUrl} width={128} height={128} alt="" />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 600, color: "#f5f5f5" }}>Outrun</div>
          <div style={{ fontSize: 30, fontWeight: 400, color: "#b8b8b8" }}>
            Your AI Growth Partner.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
