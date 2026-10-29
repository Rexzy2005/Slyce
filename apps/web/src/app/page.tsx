import { redirect } from 'next/navigation';
/** Slyyce opens straight into the app; there is no marketing landing page. */
export default function Home() { redirect('/play'); }
