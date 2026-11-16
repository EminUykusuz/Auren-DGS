import { Component } from 'react';

// Beklenmeyen render hatasında beyaz ekran yerine kurtarma ekranı gösterir.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-obsidian p-8 text-center text-slate-200">
        <h1 className="text-2xl font-semibold">Bir şeyler ters gitti</h1>
        <p className="max-w-md text-sm text-slate-400">Sayfa beklenmedik bir hata verdi. Ana sayfaya dönerek devam edebilirsin.</p>
        <a href="/" className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950" onClick={() => { window.location.replace('/'); }}>Ana sayfaya dön</a>
      </div>
    );
  }
}
