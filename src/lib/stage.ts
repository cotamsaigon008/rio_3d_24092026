/**
 * Nền "sân khấu" phía sau sản phẩm 3D: xanh rừng đậm + quầng sáng và vũng sáng dưới sàn theo màu của vị.
 * `floor` là vị trí (%) của mặt sàn trong khung, để vũng sáng nằm đúng chỗ sản phẩm đứng.
 */
export function stageBackground(glow: string, floor = 77) {
  return [
    `radial-gradient(70% 56% at 50% 46%, ${glow}55 0%, ${glow}00 72%)`,
    `radial-gradient(46% 11% at 50% ${floor}%, ${glow}88 0%, ${glow}00 100%)`,
    "linear-gradient(165deg, #1F4E3D 0%, #0C2019 100%)",
  ].join(", ");
}
