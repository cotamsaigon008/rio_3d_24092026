/**
 * Helper dùng chung (không import three.js) — an toàn cho cả server component.
 *
 * Với mỗi ảnh gốc `public/products/xxx.jpg` hoặc `public/products-light/yyy.jpg`, pipeline tách nền
 * (tools/cutout.py) tạo ra 3 thứ trong `public/3d/`:
 *   - cutout/xxx.webp : ảnh sản phẩm đã tách nền, có alpha (poster hiển thị ngay khi WebGL chưa sẵn sàng)
 *   - tex/xxx.webp    : texture đặc dùng để "dán" lên hình khối 3D
 *   - profile/{bottle,can}.json : đường viền (silhouette) để dựng hình khối tròn xoay đúng dáng chai / lon
 */

export type Kind = "bottle" | "can";

export function productAssets(image: string) {
  const slug = image.split("/").pop()!.replace(/\.(jpe?g|png|webp)$/i, "");
  const kind: Kind = image.includes("products-light") ? "can" : "bottle";
  return {
    kind,
    tex: `/3d/tex/${slug}.webp`,
    poster: `/3d/cutout/${slug}.webp`,
  };
}

/**
 * Khung hình của viewer 1 sản phẩm (đơn vị: chiều cao sản phẩm = 1).
 * Camera 3D và ảnh poster CSS dùng chung hằng số này để lúc chuyển từ poster sang canvas không bị "nhảy".
 */
export const FRAME = {
  /** chiều cao vùng nhìn thấy quanh sản phẩm */
  viewH: 1.32,
  /** khoảng trống phía dưới sản phẩm (tỉ lệ chiều cao canvas) — chỗ cho bóng đổ + phản chiếu */
  bottomPad: 0.22,
};

export const posterStyle = {
  height: `${(100 / FRAME.viewH).toFixed(2)}%`,
  bottom: `${(FRAME.bottomPad * 100).toFixed(1)}%`,
} as const;
