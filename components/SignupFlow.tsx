import type { ReactNode } from 'react';
import Link from 'next/link';
import auth from '../app/auth/page.module.css';
import styles from './SignupFlow.module.css';

/** The same frame and typography as the main signup wizard. */
export default function SignupFlow({title,description,children,returnTo,guest=false}:{title:string;description:string;children:ReactNode;returnTo?:string|null;guest?:boolean}) {
 const query=returnTo?'?returnTo='+encodeURIComponent(returnTo):'';
 return <main className={auth.page}>
  <div className={`${auth.shell} ${auth.signupShell}`}>
   <div className={auth.topBar}><Link href="/" className={auth.homeLink}>Back to home</Link></div>
   <section className={auth.frame}><div className={`${auth.authCard} ${styles.content}`}>
    <nav className={auth.modeRail} aria-label="Authentication mode">
     <Link href={'/auth'+query+'#signup'} className={`${auth.modeButton} ${!guest?auth.modeButtonActive:''} ${styles.tab}`}>Sign up</Link>
     <Link href={'/auth?switchAccount=1'+(returnTo?'&returnTo='+encodeURIComponent(returnTo):'')+'#login'} className={`${auth.modeButton} ${styles.tab}`}>Login</Link>
    </nav>
    <header className={auth.authHeader}><h1 className={auth.authTitle}>{title}</h1><p className={auth.authText}>{description}</p></header>
    {children}
   </div></section>
  </div>
 </main>;
}
