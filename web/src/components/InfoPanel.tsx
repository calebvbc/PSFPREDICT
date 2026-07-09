import type { ReactNode } from 'react';

export function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[1.5rem] bg-psf-surface p-4 shadow-card sm:rounded-[1.75rem] sm:p-5"><h2 className="mb-4 text-lg font-black sm:text-xl">{title}</h2><div className="grid gap-3">{children}</div></section>;
}

export function EmptyCard({ message }: { message: string }) {
  return <div className="rounded-[1.5rem] bg-psf-surface p-6 text-center font-bold text-psf-secondary shadow-card sm:rounded-[2rem] sm:p-8">{message}</div>;
}

export function EmptySmall({ text }: { text: string }) {
  return <p className="rounded-2xl bg-psf-background p-4 text-sm font-bold text-psf-secondary">{text}</p>;
}

export function ErrorCard({ message }: { message: string }) {
  return <div className="rounded-[1.5rem] bg-red-50 p-4 font-bold text-psf-danger">{message}</div>;
}
