'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Modal } from '@/components/cieps';

export default function ImageModal({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-goles"
        aria-label={`Ampliar imagem: ${alt}`}
      >
        <Image src={src} alt={alt} width={900} height={900} className="h-auto w-full object-contain" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={alt} className="max-w-4xl">
        <Image src={src} alt={alt} width={1400} height={1400} className="h-auto max-h-[68vh] w-full object-contain" />
      </Modal>
    </>
  );
}
