/** Five transparent engineering illustrations share one bundled artwork resource. */
export default function FeatureArt({ index }: { index: number }) {
  const cell = 1959 / 5;
  const clip = `home-art-clip-${index}`;
  return (
    <svg
      className="home-feature-art"
      viewBox={`${index * cell} 165 ${cell} 480`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <rect x={index * cell} y="165" width={cell} height="480" />
        </clipPath>
      </defs>
      <image
        clipPath={`url(#${clip})`}
        href="/home/workflow-illustrations.png"
        width="1959"
        height="803"
      />
    </svg>
  );
}
