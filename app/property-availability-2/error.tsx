'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="live-page narrow"><section className="live-card"><h1>We couldn’t load this property</h1><p>Please try again in a moment.</p><button className="button dark" onClick={reset}>Try again</button></section></main>}
