import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 36,
        backgroundColor: "#173d2c",
      }}
    >
      <div
        style={{
          width: "72%",
          height: "72%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 30,
          backgroundColor: "#d6efa8",
          color: "#173d2c",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 70,
          fontWeight: 800,
          letterSpacing: "-0.08em",
          paddingRight: 6,
          paddingBottom: 10,
        }}
      >
        p.
      </div>
    </div>,
    size,
  );
}
