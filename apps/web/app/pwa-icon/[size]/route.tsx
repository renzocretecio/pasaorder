import { ImageResponse } from "next/og";

export const revalidate = false;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  if (rawSize !== "192" && rawSize !== "512") {
    return new Response("Not found", { status: 404 });
  }

  const size = Number(rawSize);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#173d2c",
      }}
    >
      <div
        style={{
          width: "72%",
          height: "72%",
          borderRadius: "23%",
          backgroundColor: "#d6efa8",
          color: "#173d2c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: size * 0.39,
          fontWeight: 800,
          letterSpacing: "-0.08em",
          paddingRight: size * 0.035,
          paddingBottom: size * 0.06,
        }}
      >
        p.
      </div>
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
