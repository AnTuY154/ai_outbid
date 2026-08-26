export type Province = {
  slug: string;
  name: string;
};

// Administrative units effective from 12 June 2025 (NQ 202/2025/QH15).
// This is versioned application data, not a live third-party lookup.
export const provinces = [
  { slug: "an-giang", name: "An Giang" },
  { slug: "bac-ninh", name: "Bắc Ninh" },
  { slug: "cao-bang", name: "Cao Bằng" },
  { slug: "ca-mau", name: "Cà Mau" },
  { slug: "can-tho", name: "Cần Thơ" },
  { slug: "da-nang", name: "Đà Nẵng" },
  { slug: "dak-lak", name: "Đắk Lắk" },
  { slug: "dien-bien", name: "Điện Biên" },
  { slug: "dong-nai", name: "Đồng Nai" },
  { slug: "dong-thap", name: "Đồng Tháp" },
  { slug: "gia-lai", name: "Gia Lai" },
  { slug: "ha-noi", name: "Hà Nội" },
  { slug: "ha-tinh", name: "Hà Tĩnh" },
  { slug: "hai-phong", name: "Hải Phòng" },
  { slug: "hung-yen", name: "Hưng Yên" },
  { slug: "hue", name: "Huế" },
  { slug: "khanh-hoa", name: "Khánh Hòa" },
  { slug: "lai-chau", name: "Lai Châu" },
  { slug: "lam-dong", name: "Lâm Đồng" },
  { slug: "lang-son", name: "Lạng Sơn" },
  { slug: "lao-cai", name: "Lào Cai" },
  { slug: "nghe-an", name: "Nghệ An" },
  { slug: "ninh-binh", name: "Ninh Bình" },
  { slug: "phu-tho", name: "Phú Thọ" },
  { slug: "quang-ngai", name: "Quảng Ngãi" },
  { slug: "quang-ninh", name: "Quảng Ninh" },
  { slug: "quang-tri", name: "Quảng Trị" },
  { slug: "son-la", name: "Sơn La" },
  { slug: "tay-ninh", name: "Tây Ninh" },
  { slug: "thai-nguyen", name: "Thái Nguyên" },
  { slug: "thanh-hoa", name: "Thanh Hóa" },
  { slug: "ho-chi-minh", name: "Thành phố Hồ Chí Minh" },
  { slug: "tuyen-quang", name: "Tuyên Quang" },
  { slug: "vinh-long", name: "Vĩnh Long" },
] as const satisfies readonly Province[];

export function isProvinceSlug(value: string): value is (typeof provinces)[number]["slug"] {
  return provinces.some((province) => province.slug === value);
}
