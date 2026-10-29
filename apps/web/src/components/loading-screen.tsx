import { Icon } from './icon';
interface LoadingScreenProps { message?: string; detail?: string; compact?: boolean }
export function LoadingScreen({ message = 'Opening the market', detail = 'A fresh slice is on its way.', compact = false }: LoadingScreenProps) {
  return <div className={compact ? 'slyyce-loader slyyce-loader-compact' : 'slyyce-loader'} role="status" aria-live="polite" aria-atomic="true">
    <div className="slyyce-loader-art" aria-hidden="true"><span className="loader-glow" /><span className="loader-fruit loader-fruit-left" /><span className="loader-fruit loader-fruit-right" /><span className="loader-cut" /><span className="loader-drop drop-one" /><span className="loader-drop drop-two" /><span className="loader-drop drop-three" /></div>
    <div className="slyyce-loader-brand" aria-hidden="true">slyyce<span>/</span></div>
    <p className="slyyce-loader-message">{message}<span className="loader-ellipsis" aria-hidden="true">...</span></p><p className="slyyce-loader-detail">{detail}</p>
    <div className="loader-track" aria-hidden="true"><span /></div><span className="loader-signature" aria-hidden="true"><Icon name="scissors" /> THE NIGHT MARKET</span>
  </div>;
}
