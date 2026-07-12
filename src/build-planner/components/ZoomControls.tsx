// ズームコントロール(−/現在%/＋)。%ボタンクリックで100%へリセットする。
// パネルごとにCSSクラス体系が異なるため、クラス名はpropsで受ける(DOM構造は共通)。
interface ZoomControlsProps {
  zoom: number;
  min: number;
  max: number;
  step: number;
  onChange: (zoom: number) => void;
  resetTitle?: string;
  className: string;
  buttonClassName: string;
  percentClassName: string;
}

export default function ZoomControls({
  zoom,
  min,
  max,
  step,
  onChange,
  resetTitle,
  className,
  buttonClassName,
  percentClassName,
}: ZoomControlsProps) {
  const clamp = (v: number) => Math.max(min, Math.min(max, parseFloat(v.toFixed(1))));
  return (
    <div className={className}>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(clamp(zoom - step))}
        disabled={zoom <= min}
      >
        −
      </button>
      <button
        type="button"
        className={percentClassName}
        onClick={() => onChange(1.0)}
        title={resetTitle}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(clamp(zoom + step))}
        disabled={zoom >= max}
      >
        ＋
      </button>
    </div>
  );
}
