function luminance(color: string) {
  const rgb = color
    .slice(1)
    .match(/.{2}/g)!
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function accentText(color: string) {
  const value = luminance(color);
  return (value + 0.05) / 0.05 > 1.05 / (value + 0.05) ? "#000000" : "#ffffff";
}

// Preserve the store hue while making text readable on white and pale tints.
export function accentInk(color: string) {
  let shade = color;
  while (1.05 / (luminance(shade) + 0.05) < 5.5) {
    shade = `#${shade
      .slice(1)
      .match(/.{2}/g)!
      .map((channel) =>
        Math.floor(parseInt(channel, 16) * 0.95)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }
  return shade;
}
export function peso(price: string) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(price));
}
