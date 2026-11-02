import Image from "next/image";

export default function BrandMark() {
  return (
    <Image
      className="brand-symbol"
      src="/brand/vision-welding-logo.png"
      alt=""
      width={68}
      height={68}
      priority
      unoptimized
    />
  );
}
